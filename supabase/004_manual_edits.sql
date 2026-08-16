-- ===========================================================================
-- TS-Certify — manual edits to submissions
-- Run AFTER 001_schema.sql (and 002/003). Safe to re-run.
--
-- Why this exists: the Google Form does not always collect everything. A
-- student skips the end date, mistypes their email, or the form simply has no
-- question for their college. Those rows arrive incomplete and no certificate
-- can be issued for them.
--
-- Staff can now fill the gaps from /admin. The hard part is not the edit — it
-- is making the edit SURVIVE. `syncFromSheet()` upserts on `source_key`, so
-- the very next sync would overwrite a hand-typed value with the blank cell it
-- came from. `manual_overrides` records which columns a human has taken
-- ownership of; the sync re-applies them on top of the sheet data, so a manual
-- correction is permanent until someone clears it.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. submissions — remember what a human changed, and who.
-- ---------------------------------------------------------------------------
alter table public.submissions
  add column if not exists manual_overrides jsonb not null default '{}'::jsonb;

alter table public.submissions
  add column if not exists edited_at timestamptz;

alter table public.submissions
  add column if not exists edited_by uuid references auth.users(id) on delete set null;

comment on column public.submissions.manual_overrides is
  '{column: value} for fields a human filled in by hand. syncFromSheet() layers these over the sheet data so a correction is not lost on the next sync. Clearing it hands the row back to the sheet.';

-- Finding the hand-edited rows is a rare, deliberate act (auditing a mistake),
-- so a partial index keeps it cheap without taxing every sync write.
create index if not exists submissions_edited_idx
  on public.submissions (edited_at desc)
  where edited_at is not null;

-- ---------------------------------------------------------------------------
-- 2. admin_submissions_v — expose the edit state to the admin table.
--
--    `create or replace view` only permits APPENDING columns, so these three
--    go after `status`. Do not reorder anything above them.
-- ---------------------------------------------------------------------------
create or replace view public.admin_submissions_v
with (security_invoker = true) as
select
  s.id,
  s.full_name,
  s.email,
  s.phone,
  s.domain,
  s.institution,
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
  c.duration_text,

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
  end as status,

  -- Appended by 004. The edit dialog opens straight from the table row, so it
  -- needs these without a second round trip to `submissions`.
  s.notes,
  s.manual_overrides,
  s.edited_at
from public.submissions s
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

-- ---------------------------------------------------------------------------
-- Sanity check — run on its own after applying:
--
--   select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'submissions'
--     and column_name in ('manual_overrides','edited_at','edited_by');
--   -- expect 3 rows
--
--   select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'admin_submissions_v'
--     and column_name in ('notes','manual_overrides','edited_at');
--   -- expect 3 rows
-- ---------------------------------------------------------------------------
