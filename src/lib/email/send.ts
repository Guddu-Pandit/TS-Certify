import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { appEnv, gmailEnv } from "@/config/env";
import { downloadCertificate } from "@/lib/certificate/storage";
import type { CertificateRow } from "@/lib/supabase/types";
import { mailTransport, explainMailError } from "./transport";
import { loadEmailTemplate, placeholderValues, renderEmail } from "./template";

export interface SendOutcome {
  certificateId: string;
  name: string;
  to?: string;
  status: "sent" | "failed" | "skipped";
  message?: string;
}

export interface SendSummary {
  ok: boolean;
  sent: number;
  failed: number;
  skipped: number;
  results: SendOutcome[];
}

/**
 * Emails certificates to their students.
 *
 * One failure does not abort the batch — sending 29 of 30 and being told which
 * address bounced is far more useful than sending none. Every attempt, success
 * or failure, is written to `email_log`, which is where the admin table's
 * "Emailed" status is derived from.
 */
export async function sendCertificateEmails(certificateIds: string[]): Promise<SendSummary> {
  const admin = supabaseAdmin();
  const results: SendOutcome[] = [];

  // Fail fast and clearly if Gmail is not configured, rather than producing
  // one identical error per row.
  let from: string;
  try {
    const { GMAIL_USER } = gmailEnv();
    const { ORG_NAME } = appEnv();
    from = `"${ORG_NAME}" <${GMAIL_USER}>`;
  } catch (err) {
    return {
      ok: false,
      sent: 0,
      failed: certificateIds.length,
      skipped: 0,
      results: certificateIds.map((id) => ({
        certificateId: id,
        name: "",
        status: "failed" as const,
        message: err instanceof Error ? err.message : "Gmail is not configured.",
      })),
    };
  }

  const template = await loadEmailTemplate();
  const transporter = mailTransport();

  for (const certificateId of certificateIds) {
    try {
      // The student's email lives on `submissions`, never on `certificates` —
      // that separation is what keeps the public verify page unable to leak
      // contact details. This join is the only place it is read.
      const { data: certificate } = await admin
        .from("certificates")
        .select("*, submissions!inner(email)")
        .eq("certificate_id", certificateId)
        .maybeSingle<CertificateRow & { submissions: { email: string | null } }>();

      if (!certificate) {
        results.push({ certificateId, name: "", status: "failed", message: "Certificate not found." });
        continue;
      }

      if (certificate.revoked_at) {
        results.push({
          certificateId,
          name: certificate.full_name,
          status: "skipped",
          message: "Certificate is revoked — not sending.",
        });
        continue;
      }

      const to = certificate.submissions?.email?.trim();
      if (!to) {
        results.push({
          certificateId,
          name: certificate.full_name,
          status: "skipped",
          message: "No email address on file for this student.",
        });
        continue;
      }

      if (!certificate.pdf_path) {
        results.push({
          certificateId,
          name: certificate.full_name,
          status: "failed",
          to,
          message: "No PDF stored. Re-generate the certificate first.",
        });
        continue;
      }

      const values = placeholderValues(certificate);
      const email = renderEmail(template, values);

      // Attach the PDF itself, never a link: signed URLs expire, and a
      // link-only certificate email reads like phishing.
      const pdf = await downloadCertificate(certificate.pdf_path);

      const info = await transporter.sendMail({
        from,
        to,
        subject: email.subject,
        text: email.text,
        html: email.html,
        attachments: [
          { filename: email.attachmentName, content: pdf, contentType: "application/pdf" },
        ],
      });

      await admin.from("email_log").insert({
        certificate_id: certificate.id,
        to_email: to,
        subject: email.subject,
        status: "sent",
        message_id: info.messageId ?? null,
      });

      results.push({ certificateId, name: certificate.full_name, to, status: "sent" });
    } catch (err) {
      const message = explainMailError(err);

      // Record the failure so the admin table shows "Email failed" with the
      // reason, instead of the attempt vanishing.
      const { data: row } = await admin
        .from("certificates")
        .select("id, full_name, submissions!inner(email)")
        .eq("certificate_id", certificateId)
        .maybeSingle<{ id: string; full_name: string; submissions: { email: string | null } }>();

      if (row) {
        await admin.from("email_log").insert({
          certificate_id: row.id,
          to_email: row.submissions?.email ?? "unknown",
          status: "failed",
          error: message,
        });
      }

      results.push({
        certificateId,
        name: row?.full_name ?? "",
        status: "failed",
        message,
      });
    }
  }

  const count = (s: SendOutcome["status"]) => results.filter((r) => r.status === s).length;

  return {
    ok: count("failed") === 0,
    sent: count("sent"),
    failed: count("failed"),
    skipped: count("skipped"),
    results,
  };
}
