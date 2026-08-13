import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { appEnv } from "@/config/env";
import { verifyUrl } from "@/lib/certificate/qr";
import { durationSentence, formatDate } from "@/lib/dates";
import {
  CERTIFICATE_EMAIL_TEMPLATE_KEY,
  type CertificateRow,
  type EmailTemplateRow,
} from "@/lib/supabase/types";

/**
 * Placeholders available in the email template.
 *
 * Shown as clickable chips in the editor at /admin/settings/email, so this
 * list is the single source of truth for both substitution and the UI.
 */
export const PLACEHOLDERS = [
  { token: "name", description: "Student's full name" },
  { token: "firstName", description: "First word of their name" },
  { token: "domain", description: "Internship domain" },
  { token: "duration", description: "e.g. 8 Weeks (12 Jan 2026 to 09 Mar 2026)" },
  { token: "startDate", description: "Start date" },
  { token: "endDate", description: "End date" },
  { token: "institution", description: "School or college" },
  { token: "certificateId", description: "e.g. TS-2026-0001" },
  { token: "verifyUrl", description: "Public verification link" },
  { token: "issuedOn", description: "Date the certificate was issued" },
  { token: "orgName", description: "Your organisation name (from ORG_NAME)" },
] as const;

export type PlaceholderValues = Record<(typeof PLACEHOLDERS)[number]["token"], string>;

/** Builds the substitution values for one certificate. */
export function placeholderValues(certificate: CertificateRow): PlaceholderValues {
  const { ORG_NAME } = appEnv();
  const name = certificate.full_name;

  return {
    name,
    firstName: name.trim().split(/\s+/)[0] ?? name,
    domain: certificate.domain ?? "",
    // One function decides this wording, so changing it changes the
    // certificate and the email together.
    duration: durationSentence(certificate.start_date, certificate.end_date),
    startDate: formatDate(certificate.start_date),
    endDate: formatDate(certificate.end_date),
    institution: certificate.institution ?? "",
    certificateId: certificate.certificate_id,
    verifyUrl: verifyUrl(certificate.certificate_id),
    issuedOn: formatDate(certificate.issued_on),
    orgName: ORG_NAME,
  };
}

/** Replaces {{token}} occurrences. Unknown tokens are left visible on purpose. */
export function render(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (whole, token: string) =>
    token in values ? values[token] : whole,
  );
}

/** Fallback used if the seed row was never inserted. */
const FALLBACK: Omit<EmailTemplateRow, "updated_at" | "updated_by"> = {
  key: CERTIFICATE_EMAIL_TEMPLATE_KEY,
  subject: "Your {{domain}} Internship Certificate — {{certificateId}}",
  body_text:
    "Dear {{name}},\n\nCongratulations on completing your {{domain}} internship with {{orgName}} ({{duration}}).\n\nYour certificate is attached. Verify it any time at:\n{{verifyUrl}}\n\nWarm regards,\n{{orgName}}",
  body_html:
    "<p>Dear {{name}},</p><p>Congratulations on completing your {{domain}} internship with {{orgName}} ({{duration}}).</p><p>Your certificate is attached. Verify it any time at <a href=\"{{verifyUrl}}\">{{verifyUrl}}</a>.</p><p>Warm regards,<br>{{orgName}}</p>",
  attachment_name: "{{name}} - {{domain}} Certificate.pdf",
};

export async function loadEmailTemplate(): Promise<EmailTemplateRow> {
  const { data } = await supabaseAdmin()
    .from("email_templates")
    .select("*")
    .eq("key", CERTIFICATE_EMAIL_TEMPLATE_KEY)
    .maybeSingle<EmailTemplateRow>();

  return data ?? { ...FALLBACK, updated_at: new Date().toISOString(), updated_by: null };
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
  attachmentName: string;
}

export function renderEmail(
  template: Pick<EmailTemplateRow, "subject" | "body_text" | "body_html" | "attachment_name">,
  values: Record<string, string>,
): RenderedEmail {
  // Strip characters that are illegal in filenames on Windows and macOS —
  // a domain like "AI/ML" would otherwise produce an unopenable attachment.
  const attachmentName = render(template.attachment_name, values)
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  return {
    subject: render(template.subject, values),
    text: render(template.body_text, values),
    html: render(template.body_html, values),
    attachmentName: attachmentName.toLowerCase().endsWith(".pdf")
      ? attachmentName
      : `${attachmentName}.pdf`,
  };
}
