import { requireApiUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { signedUrl } from "@/lib/certificate/storage";
import type { CertificateRow } from "@/lib/supabase/types";

export const runtime = "nodejs";

/**
 * Redirects to a freshly signed URL for a certificate file.
 *
 * `id` is the human-readable certificate id (TS-2026-0001).
 * `?format=png` returns the image instead of the PDF.
 *
 * The URL is minted per click rather than embedded in the page, so a link
 * copied out of the HTML cannot outlive the session that produced it.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error: authError } = await requireApiUser();
  if (authError) return authError;

  const { id } = await params;
  const format = new URL(request.url).searchParams.get("format") === "png" ? "png" : "pdf";

  const { data: certificate } = await supabaseAdmin()
    .from("certificates")
    .select("certificate_id, pdf_path, png_path")
    .eq("certificate_id", id)
    .maybeSingle<Pick<CertificateRow, "certificate_id" | "pdf_path" | "png_path">>();

  if (!certificate) {
    return Response.json({ ok: false, error: "Certificate not found." }, { status: 404 });
  }

  const path = format === "png" ? certificate.png_path : certificate.pdf_path;
  if (!path) {
    return Response.json(
      { ok: false, error: `No ${format.toUpperCase()} stored for this certificate. Re-generate it.` },
      { status: 404 },
    );
  }

  try {
    return Response.redirect(await signedUrl(path, 300), 302);
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "Could not produce a download link." },
      { status: 500 },
    );
  }
}
