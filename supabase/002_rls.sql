-- ===========================================================================
-- TS-Certify — row level security
-- Run AFTER 001_schema.sql.
--
-- The security model in one sentence: RLS is on for every table, only ONE
-- table has a public read policy, and that table contains nothing private.
--
-- This is what makes NEXT_PUBLIC_SUPABASE_ANON_KEY safe to ship to browsers.
-- ===========================================================================

alter table public.submissions          enable row level security;
alter table public.certificates         enable row level security;
alter table public.certificate_counters enable row level security;
alter table public.email_log            enable row level security;
alter table public.email_templates      enable row level security;

-- ---------------------------------------------------------------------------
-- submissions / certificate_counters / email_log / email_templates
--
-- Intentionally have NO policies at all. With RLS enabled and zero policies,
-- Postgres denies every row to both `anon` AND `authenticated`. The admin UI
-- reads them with the service_role key, which bypasses RLS by design and is
-- only ever used server-side.
--
-- Note this means a logged-in admin's *browser* still cannot read submissions
-- with the anon key. That is deliberate: an XSS or a leaked anon key gains
-- nothing.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- certificates — the single public read in the entire application.
-- Powers the QR verification page for anyone who scans a certificate.
-- ---------------------------------------------------------------------------
drop policy if exists "anon reads active certificates" on public.certificates;
create policy "anon reads active certificates"
  on public.certificates
  for select
  to anon
  using (revoked_at is null);

-- Defence in depth: even with the policy above, anon may only see the columns
-- actually printed on the certificate. This hides submission_id (an internal
-- id that would otherwise be enumerable) and the storage paths.
-- Column privileges are checked independently of RLS, so a careless
-- select('*') on the verify page fails loudly instead of over-fetching.
revoke select on public.certificates from anon;
grant  select (certificate_id, full_name, domain, start_date, end_date,
               duration_text, issued_on, revoked_at)
  on public.certificates to anon;

-- ---------------------------------------------------------------------------
-- Sanity check. Run this block on its own after applying the file; every row
-- must report rls_enabled = true, and only `certificates` may list a policy.
-- ---------------------------------------------------------------------------
-- select relname as table_name, relrowsecurity as rls_enabled
-- from pg_class
-- where relnamespace = 'public'::regnamespace and relkind = 'r'
-- order by relname;
--
-- select tablename, policyname, roles, cmd
-- from pg_policies where schemaname = 'public'
-- order by tablename;
