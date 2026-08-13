import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { appEnv, siteUrl } from "@/config/env";
import { TEMPLATE } from "@/config/template";
import { durationLabel } from "@/lib/dates";
import type { CertificateRow, SubmissionRow } from "@/lib/supabase/types";
import { renderCertificate } from "./render";
import { pngToPdf } from "./to-pdf";
import { uploadCertificate } from "./storage";

export interface GenerateOutcome {
  submissionId: string;
  name: string;
  status: "created" | "regenerated" | "skipped" | "failed";
  certificateId?: string;
  version?: number;
  message?: string;
  /** Fields the renderer had to shrink or wrap to fit. */
  adjustedFields?: string[];
}

export interface GenerateSummary {
  ok: boolean;
  created: number;
  regenerated: number;
  skipped: number;
  failed: number;
  results: GenerateOutcome[];
}

function requiredFieldProblems(s: SubmissionRow): string[] {
  const problems: string[] = [];
  if (!s.full_name?.trim()) problems.push("no name");
  if (!s.domain?.trim()) problems.push("no domain");
  if (!s.start_date) problems.push("no start date");
  if (!s.end_date) problems.push("no end date");
  return problems;
}

/**
 * Generates certificates for the given submissions.
 *
 * Runs strictly SEQUENTIALLY. Each render holds a full 3508x2480 RGBA bitmap —
 * about 35MB — so a parallel batch would exhaust a serverless function's
 * memory long before it finished.
 *
 * A row that fails does not abort the batch: it is reported and the rest
 * continue. Issuing 29 of 30 certificates and being told which one failed is
 * far more useful than issuing none.
 */
export async function generateCertificates(
  submissionIds: string[],
  opts: { force?: boolean } = {},
): Promise<GenerateSummary> {
  const admin = supabaseAdmin();
  const { CERT_ID_PREFIX } = appEnv();

  // A certificate generated against localhost has a permanently dead QR code,
  // because the URL is baked into the image. Refuse rather than quietly
  // producing worthless documents.
  if (process.env.NODE_ENV === "production" && /localhost|127\.0\.0\.1/.test(siteUrl)) {
    return {
      ok: false,
      created: 0,
      regenerated: 0,
      skipped: 0,
      failed: submissionIds.length,
      results: submissionIds.map((id) => ({
        submissionId: id,
        name: "",
        status: "failed",
        message:
          "NEXT_PUBLIC_SITE_URL still points at localhost. Set it to the real public URL before issuing certificates, or their QR codes will never work.",
      })),
    };
  }

  const results: GenerateOutcome[] = [];

  for (const submissionId of submissionIds) {
    try {
      const { data: submission, error } = await admin
        .from("submissions")
        .select("*")
        .eq("id", submissionId)
        .maybeSingle<SubmissionRow>();

      if (error || !submission) {
        results.push({
          submissionId,
          name: "",
          status: "failed",
          message: error?.message ?? "Submission not found.",
        });
        continue;
      }

      const problems = requiredFieldProblems(submission);
      if (problems.length > 0) {
        results.push({
          submissionId,
          name: submission.full_name,
          status: "failed",
          message: `Cannot issue: ${problems.join(", ")}.`,
        });
        continue;
      }

      // An active certificate already exists?
      const { data: existing } = await admin
        .from("certificates")
        .select("*")
        .eq("submission_id", submissionId)
        .is("revoked_at", null)
        .maybeSingle<CertificateRow>();

      if (existing && !opts.force) {
        // Default behaviour, so a double-click or a repeated bulk run is a
        // no-op rather than churning storage and confusing the operator.
        results.push({
          submissionId,
          name: submission.full_name,
          status: "skipped",
          certificateId: existing.certificate_id,
          version: existing.version,
          message: "Already has a certificate. Use Re-generate to replace it.",
        });
        continue;
      }

      // Re-issue keeps the SAME id: the QR on copies already in circulation
      // encodes the id, not the file, so it keeps resolving.
      let certificateId: string;
      let version: number;

      if (existing) {
        certificateId = existing.certificate_id;
        version = existing.version + 1;
      } else {
        const { data: newId, error: idError } = await admin.rpc("next_certificate_id", {
          p_prefix: CERT_ID_PREFIX,
        });
        if (idError || !newId) {
          results.push({
            submissionId,
            name: submission.full_name,
            status: "failed",
            message: `Could not allocate a certificate id: ${idError?.message ?? "unknown"}`,
          });
          continue;
        }
        certificateId = newId as string;
        version = 1;
      }

      const issuedOn = existing?.issued_on ?? new Date().toISOString().slice(0, 10);

      const { png, adjustedFields } = await renderCertificate({
        certificateId,
        fullName: submission.full_name,
        domain: submission.domain,
        institution: submission.institution,
        startDate: submission.start_date,
        endDate: submission.end_date,
        issuedOn,
      });
      const pdf = await pngToPdf(png);

      const paths = await uploadCertificate({
        certificateId,
        domain: submission.domain,
        issuedOn,
        png,
        pdf,
      });

      // The snapshot: what this document says, frozen at issue time. If the
      // sheet is corrected later, an already-issued certificate must not
      // silently change — only a deliberate re-generate refreshes it.
      const row = {
        certificate_id: certificateId,
        submission_id: submissionId,
        full_name: submission.full_name,
        domain: submission.domain,
        institution: submission.institution,
        start_date: submission.start_date,
        end_date: submission.end_date,
        duration_text: durationLabel(submission.start_date, submission.end_date),
        issued_on: issuedOn,
        version,
        pdf_path: paths.pdf,
        png_path: paths.png,
        template_key: TEMPLATE.key,
      };

      const { error: writeError } = existing
        ? await admin.from("certificates").update(row).eq("id", existing.id)
        : await admin.from("certificates").insert(row);

      if (writeError) {
        results.push({
          submissionId,
          name: submission.full_name,
          status: "failed",
          message: `Saved the file but could not record it: ${writeError.message}`,
        });
        continue;
      }

      results.push({
        submissionId,
        name: submission.full_name,
        status: existing ? "regenerated" : "created",
        certificateId,
        version,
        adjustedFields: adjustedFields.length ? adjustedFields : undefined,
      });
    } catch (err) {
      results.push({
        submissionId,
        name: "",
        status: "failed",
        message: err instanceof Error ? err.message : "Unexpected error.",
      });
    }
  }

  const count = (s: GenerateOutcome["status"]) => results.filter((r) => r.status === s).length;

  return {
    ok: count("failed") === 0,
    created: count("created"),
    regenerated: count("regenerated"),
    skipped: count("skipped"),
    failed: count("failed"),
    results,
  };
}
