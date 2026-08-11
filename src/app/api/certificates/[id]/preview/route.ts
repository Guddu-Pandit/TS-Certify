import { requireApiUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { renderCertificate } from "@/lib/certificate/render";
import type { SubmissionRow } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Renders a certificate live and returns the PNG. Persists NOTHING — no
 * storage upload, no database row, no certificate id consumed.
 *
 * This is the fast loop for checking template coordinates against real data:
 * open it in a tab, adjust src/config/template.ts, reload.
 *
 * `id` is a SUBMISSION id, so a preview works before anything is issued.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error: authError } = await requireApiUser();
  if (authError) return authError;

  // In Next 15+ params is a Promise.
  const { id } = await params;

  const { data: submission, error } = await supabaseAdmin()
    .from("submissions")
    .select("*")
    .eq("id", id)
    .maybeSingle<SubmissionRow>();

  if (error || !submission) {
    return Response.json({ ok: false, error: "Submission not found." }, { status: 404 });
  }

  // Reuse the real id if one exists, so the preview's QR is the real QR.
  const { data: existing } = await supabaseAdmin()
    .from("certificates")
    .select("certificate_id, issued_on")
    .eq("submission_id", id)
    .is("revoked_at", null)
    .maybeSingle<{ certificate_id: string; issued_on: string }>();

  try {
    const { png } = await renderCertificate({
      // PREVIEW makes it obvious this is not an issued document, and cannot
      // collide with a real id.
      certificateId: existing?.certificate_id ?? "PREVIEW-0000",
      fullName: submission.full_name || "Student Name",
      domain: submission.domain,
      institution: submission.institution,
      startDate: submission.start_date,
      endDate: submission.end_date,
      issuedOn: existing?.issued_on ?? new Date(),
    });

    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        // Never cache: the whole point is seeing edits immediately.
        "Cache-Control": "no-store, max-age=0",
        "Content-Disposition": `inline; filename="preview-${id}.png"`,
      },
    });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "Render failed." },
      { status: 500 },
    );
  }
}
