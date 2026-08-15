-- ===========================================================================
-- TS-Certify — editable certificate layout
-- Run AFTER 001_schema.sql (and 002/003/004). Safe to re-run.
--
-- Why this exists: where the name, the ID and the date sit on the artwork used
-- to be source code. Nudging a field 20 pixels meant an edit, a commit and a
-- redeploy — so in practice nobody nudged anything, and certificates went out
-- slightly wrong.
--
-- The positions now live here, editable from /admin/template. The ARTWORK
-- itself is still a file in the repo and is never modified: the renderer
-- composites text on top of it, so a bad layout is always one "Reset" away
-- from the defaults in src/config/template.ts.
-- ===========================================================================

create table if not exists public.certificate_layouts (
  key         text primary key,
  -- The whole field list as one document. Fields are added and removed from
  -- the UI, so a column-per-field schema would need a migration every time
  -- somebody wants to print one more line.
  fields      jsonb not null,
  qr          jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null
);

comment on table public.certificate_layouts is
  'Field positions for the certificate artwork, edited at /admin/template. One row per layout key; the app reads "active". Validated against the zod schema in src/lib/certificate/layout.ts on both read and write — an invalid row falls back to DEFAULT_LAYOUT rather than producing broken certificates.';

-- Same posture as submissions and email_templates: RLS on, no policies, so
-- neither `anon` nor `authenticated` can read or write it with the anon key.
-- The admin UI goes through the service role, server-side only.
alter table public.certificate_layouts enable row level security;

-- ---------------------------------------------------------------------------
-- Sanity check — run on its own after applying:
--
--   select relname, relrowsecurity from pg_class
--   where relnamespace = 'public'::regnamespace and relname = 'certificate_layouts';
--   -- expect one row, relrowsecurity = true
--
--   select key, jsonb_array_length(fields) as field_count, updated_at
--   from public.certificate_layouts;
--   -- empty until someone saves from /admin/template; that is normal
-- ---------------------------------------------------------------------------
