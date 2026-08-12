-- ===========================================================================
-- TS-Certify — schema
-- Run this in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query).
-- Safe to re-run: every object is created with IF NOT EXISTS / OR REPLACE.
-- Run 002_rls.sql next, then 003_seed.sql.
-- ===========================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. submissions — PRIVATE. Everything the Google Form collected.
--    Holds email/phone and a verbatim dump of the sheet row, so nothing in
--    this table may ever reach a browser. No RLS policy is ever written for
--    it; all access goes through the service-role key, server-side only.
-- ---------------------------------------------------------------------------
create table if not exists public.submissions (
  id              uuid primary key default gen_random_uuid(),

  -- Idempotency key: sha256(lower(email) || '|' || submitted_at_iso).
  -- Google Form rows have no stable id and row index shifts when the sheet is
  -- sorted or rows are deleted, so re-sync matches on this instead.
  source_key      text not null unique,
  source_sheet_id text not null,
  source_tab      text,
  source_row      int,                        -- 1-based sheet row, informational only

  submitted_at    timestamptz,                -- the form's "Timestamp" column

  full_name       text not null,
  email           text,
  phone           text,
  domain          text,
  start_date      date,
  end_date        date,

  -- Sheet columns that FIELD_MAP does not claim yet. Captured automatically so
  -- no data is lost before you decide which extra fields deserve real columns.
  extra           jsonb not null default '{}'::jsonb,
  -- The whole row, verbatim, as {header: cell}. Invaluable for debugging mapping.
  raw             jsonb not null default '{}'::jsonb,

  notes           text,
  synced_at       timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists submissions_submitted_at_idx on public.submissions (submitted_at desc nulls last);
create index if not exists submissions_email_idx        on public.submissions (lower(email));
create index if not exists submissions_domain_idx       on public.submissions (domain);

-- ---------------------------------------------------------------------------
-- 2. Human-readable certificate ids: TS-2026-0001
-- ---------------------------------------------------------------------------
create table if not exists public.certificate_counters (
  year     int primary key,
  last_seq int not null default 0
);

create or replace function public.next_certificate_id(p_prefix text default 'TS')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Asia/Kolkata, not UTC: otherwise the certificate year flips at 05:30 local.
  v_year int := extract(year from (now() at time zone 'Asia/Kolkata'))::int;
  v_seq  int;
begin
  -- INSERT .. ON CONFLICT DO UPDATE row-locks the counter for the duration of
  -- the statement, so two concurrent generates serialise and get 1 and 2.
  -- They can never read the same value.
  insert into public.certificate_counters as c (year, last_seq)
  values (v_year, 1)
  on conflict (year) do update set last_seq = c.last_seq + 1
  returning c.last_seq into v_seq;

  return p_prefix || '-' || v_year::text || '-' || lpad(v_seq::text, 4, '0');
end;
$$;

revoke execute on function public.next_certificate_id(text) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. certificates — PUBLIC-READABLE. Only what is printed on the document,
--    which is public by definition. Deliberately contains no email or phone,
--    so the /verify page cannot leak PII even if its query is careless.
--    Values are a SNAPSHOT frozen at issue time: correcting the sheet later
--    must not silently change a certificate already in someone's hands.
-- ---------------------------------------------------------------------------
create table if not exists public.certificates (
  id             uuid primary key default gen_random_uuid(),
  certificate_id text not null unique,        -- 'TS-2026-0001'
  submission_id  uuid not null references public.submissions(id) on delete cascade,

  full_name      text not null,
  domain         text,
  start_date     date,
  end_date       date,
  duration_text  text,                        -- e.g. '8 Weeks'
  issued_on      date not null default current_date,

  version        int  not null default 1,     -- bumped on re-render
  png_path       text,                        -- storage object path
  pdf_path       text,
  template_key   text,                        -- which template config produced it

  revoked_at     timestamptz,
  revoke_reason  text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- At most ONE active certificate per submission. Revoking frees the slot,
-- which is what makes "revoke + re-issue with a new id" work.
create unique index if not exists certificates_one_active_per_submission
  on public.certificates (submission_id) where revoked_at is null;

create index if not exists certificates_submission_idx on public.certificates (submission_id);
create index if not exists certificates_issued_on_idx  on public.certificates (issued_on desc);

-- ---------------------------------------------------------------------------
-- 4. email_log — PRIVATE, append-only send history.
--    Send status is derived from this rather than stored as a boolean on
--    certificates, so there is nothing to drift out of sync.
-- ---------------------------------------------------------------------------
create table if not exists public.email_log (
  id             uuid primary key default gen_random_uuid(),
  certificate_id uuid not null references public.certificates(id) on delete cascade,
  to_email       text not null,
  subject        text,
  status         text not null check (status in ('sent','failed')),
  message_id     text,
  error          text,
  sent_at        timestamptz not null default now()
);

create index if not exists email_log_cert_idx on public.email_log (certificate_id, sent_at desc);

-- ---------------------------------------------------------------------------
-- 5. email_templates — PRIVATE. Editable from /admin/settings/email so the
--    wording can change without a code change or redeploy.
-- ---------------------------------------------------------------------------
create table if not exists public.email_templates (
  key             text primary key,           -- 'certificate_delivery'
  subject         text not null,
  body_html       text not null,
  body_text       text not null,
  attachment_name text not null default '{{name}} - {{domain}} Certificate.pdf',
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users(id) on delete set null
);

-- ---------------------------------------------------------------------------
-- 6. updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists submissions_touch on public.submissions;
create trigger submissions_touch before update on public.submissions
  for each row execute function public.touch_updated_at();

drop trigger if exists certificates_touch on public.certificates;
create trigger certificates_touch before update on public.certificates
  for each row execute function public.touch_updated_at();

drop trigger if exists email_templates_touch on public.email_templates;
create trigger email_templates_touch before update on public.email_templates
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 7. admin_submissions_v — one row per submission with its active certificate
--    and latest email attempt, so /admin is a single query instead of three.
--    security_invoker means the view does NOT bypass RLS: an anon caller sees
--    nothing, because submissions has no anon policy.
-- ---------------------------------------------------------------------------
create or replace view public.admin_submissions_v
with (security_invoker = true) as
select
  s.id,
  s.full_name,
  s.email,
  s.phone,
  s.domain,
  s.start_date,
  s.end_date,
  s.submitted_at,
  s.synced_at,
  s.extra,

  c.id             as cert_row_id,
  c.certificate_id,
  c.version        as cert_version,
  c.issued_on,
  c.pdf_path,
  c.png_path,
  c.revoked_at,

  le.sent_at       as last_email_at,
  le.status        as last_email_status,
  le.error         as last_email_error,
  le.to_email      as last_email_to,

  -- Derived status. Never stored, so it cannot disagree with the underlying rows.
  case
    when c.id is null              then 'new'
    when c.revoked_at is not null  then 'revoked'
    when le.status = 'sent'        then 'emailed'
    when le.status = 'failed'      then 'email_failed'
    else                                'generated'
  end as status
from public.submissions s
-- Prefer the active certificate; if there is none, fall back to the most
-- recently revoked one so the row can still report status 'revoked'.
left join lateral (
  select *
  from public.certificates cc
  where cc.submission_id = s.id
  order by (cc.revoked_at is null) desc, cc.created_at desc
  limit 1
) c on true
left join lateral (
  select el.sent_at, el.status, el.error, el.to_email
  from public.email_log el
  where el.certificate_id = c.id
  order by el.sent_at desc
  limit 1
) le on true;
