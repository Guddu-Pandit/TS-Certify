-- ===========================================================================
-- TS-Certify — seed data
-- Run AFTER 002_rls.sql.
--
-- Inserts the default email template (required — the send flow reads it) and
-- three fake submissions so the admin UI has something to render before the
-- Google Sheets sync exists. Safe to re-run.
--
-- To clear the fake students later:
--   delete from public.submissions where source_key like 'seed-%';
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Default email template. Edit it later at /admin/settings/email — this is
-- only the starting point, and re-running this file will NOT overwrite your
-- edits (on conflict do nothing).
-- ---------------------------------------------------------------------------
insert into public.email_templates (key, subject, body_html, body_text, attachment_name)
values (
  'certificate_delivery',
  'Your {{domain}} Internship Certificate — {{certificateId}}',
  $html$<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f2937;max-width:560px;margin:0 auto;padding:8px">
  <p style="margin:0 0 16px">Dear {{name}},</p>

  <p style="margin:0 0 16px">
    Congratulations on successfully completing your <strong>{{domain}}</strong>
    internship with {{orgName}}.
  </p>

  <p style="margin:0 0 16px">
    Duration: <strong>{{duration}}</strong><br>
    Certificate ID: <strong>{{certificateId}}</strong>
  </p>

  <p style="margin:0 0 24px">
    Your certificate is attached to this email as a PDF. It can also be
    verified online at any time using the link below or by scanning the QR
    code printed on the certificate.
  </p>

  <p style="margin:0 0 28px">
    <a href="{{verifyUrl}}"
       style="background:#12284c;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:6px;display:inline-block;font-weight:600">
      Verify this certificate
    </a>
  </p>

  <p style="margin:0 0 16px">We wish you the very best for what comes next.</p>

  <p style="margin:0">Warm regards,<br><strong>{{orgName}}</strong></p>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 12px">
  <p style="margin:0;font-size:12px;color:#6b7280">
    Verification link: {{verifyUrl}}
  </p>
</div>$html$,
  $text$Dear {{name}},

Congratulations on successfully completing your {{domain}} internship with {{orgName}}.

Duration: {{duration}}
Certificate ID: {{certificateId}}

Your certificate is attached to this email as a PDF. It can also be verified
online at any time, or by scanning the QR code printed on the certificate:

{{verifyUrl}}

We wish you the very best for what comes next.

Warm regards,
{{orgName}}$text$,
  '{{name}} - {{domain}} Certificate.pdf'
)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Three fake submissions. source_key values are prefixed 'seed-' so they can
-- never collide with a real sha256 sync key and are trivial to delete.
-- ---------------------------------------------------------------------------
insert into public.submissions
  (source_key, source_sheet_id, source_tab, source_row, submitted_at,
   full_name, email, phone, domain, start_date, end_date, raw)
values
  ('seed-001', 'SEED', 'Form Responses 1', 2, now() - interval '20 days',
   'Aarav Sharma', 'aarav.sharma@example.com', '+91 98765 43210',
   'Web Development', current_date - 60, current_date - 4,
   '{"Timestamp":"seed","Full Name":"Aarav Sharma"}'::jsonb),

  ('seed-002', 'SEED', 'Form Responses 1', 3, now() - interval '18 days',
   'Priya Venkataraman', 'priya.v@example.com', '+91 91234 56780',
   'Data Science', current_date - 55, current_date - 3,
   '{"Timestamp":"seed","Full Name":"Priya Venkataraman"}'::jsonb),

  -- Deliberately long name: use this one to check that the renderer shrinks
  -- and wraps text instead of spilling over the template border.
  ('seed-003', 'SEED', 'Form Responses 1', 4, now() - interval '15 days',
   'Lakshminarayanan Balasubramaniam', 'lakshmi.b@example.com', '+91 99887 76655',
   'Machine Learning', current_date - 50, current_date - 1,
   '{"Timestamp":"seed","Full Name":"Lakshminarayanan Balasubramaniam"}'::jsonb)
on conflict (source_key) do nothing;
