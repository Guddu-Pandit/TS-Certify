/**
 * Row types mirroring supabase/001_schema.sql.
 *
 * Hand-written rather than generated, so the schema files stay the single
 * source of truth and there is no codegen step to remember. If you change a
 * column in 001_schema.sql, change it here too.
 */

export type SubmissionStatus =
  | "new"
  | "generated"
  | "emailed"
  | "email_failed"
  | "revoked";

/** public.submissions — PRIVATE. Never send one of these to a client component. */
export interface SubmissionRow {
  id: string;
  source_key: string;
  source_sheet_id: string;
  source_tab: string | null;
  source_row: number | null;
  submitted_at: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  domain: string | null;
  start_date: string | null;
  end_date: string | null;
  extra: Record<string, unknown>;
  raw: Record<string, unknown>;
  notes: string | null;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

/** What the sync writes. The DB fills in the rest. */
export type SubmissionInsert = Pick<
  SubmissionRow,
  | "source_key"
  | "source_sheet_id"
  | "source_tab"
  | "source_row"
  | "submitted_at"
  | "full_name"
  | "email"
  | "phone"
  | "domain"
  | "start_date"
  | "end_date"
  | "extra"
  | "raw"
> & { synced_at?: string };

/** public.certificates — the public-safe snapshot behind /verify. */
export interface CertificateRow {
  id: string;
  certificate_id: string;
  submission_id: string;
  full_name: string;
  domain: string | null;
  start_date: string | null;
  end_date: string | null;
  duration_text: string | null;
  issued_on: string;
  version: number;
  png_path: string | null;
  pdf_path: string | null;
  template_key: string | null;
  revoked_at: string | null;
  revoke_reason: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * The only columns `anon` is granted on public.certificates. Selecting
 * anything outside this list from the verify page is a permission error, by
 * design — see supabase/002_rls.sql.
 */
export const PUBLIC_CERTIFICATE_COLUMNS = [
  "certificate_id",
  "full_name",
  "domain",
  "start_date",
  "end_date",
  "duration_text",
  "issued_on",
  "revoked_at",
] as const;

export type PublicCertificate = Pick<
  CertificateRow,
  (typeof PUBLIC_CERTIFICATE_COLUMNS)[number]
>;

/** public.email_log — append-only send history. */
export interface EmailLogRow {
  id: string;
  certificate_id: string;
  to_email: string;
  subject: string | null;
  status: "sent" | "failed";
  message_id: string | null;
  error: string | null;
  sent_at: string;
}

/** public.email_templates — the UI-editable copy. */
export interface EmailTemplateRow {
  key: string;
  subject: string;
  body_html: string;
  body_text: string;
  attachment_name: string;
  updated_at: string;
  updated_by: string | null;
}

/** public.admin_submissions_v — one row per submission for the admin table. */
export interface AdminSubmissionRow {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  domain: string | null;
  start_date: string | null;
  end_date: string | null;
  submitted_at: string | null;
  synced_at: string;
  extra: Record<string, unknown>;

  cert_row_id: string | null;
  certificate_id: string | null;
  cert_version: number | null;
  issued_on: string | null;
  pdf_path: string | null;
  png_path: string | null;
  revoked_at: string | null;

  last_email_at: string | null;
  last_email_status: "sent" | "failed" | null;
  last_email_error: string | null;
  last_email_to: string | null;

  status: SubmissionStatus;
}

/** Storage bucket holding generated certificate files. Private. */
export const CERTIFICATES_BUCKET = "certificates";

/** Key of the row in public.email_templates used by the send flow. */
export const CERTIFICATE_EMAIL_TEMPLATE_KEY = "certificate_delivery";
