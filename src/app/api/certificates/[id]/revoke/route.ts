import { requireApiUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Revokes a certificate.
 *
 * Its QR code immediately starts reporting "could not be verified" — which is
 * the entire point of having a verification system. The row is kept, not
 * deleted, so the audit trail survives.
 *
 * Revoking also frees the partial unique index on submission_id, so the
 * student can be re-issued a certificate under a NEW id afterwards.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error: authError } = await requireApiUser();
  if (authError) return authError;

  const { id } = await params;

  let reason: string | null = null;
  try {
    const body = (await request.json()) as { reason?: unknown };
    if (typeof body.reason === "string" && body.reason.trim()) reason = body.reason.trim();
  } catch {
    // No body is fine — reason is optional.
  }

  const { data, error } = await supabaseAdmin()
    .from("certificates")
    .update({ revoked_at: new Date().toISOString(), revoke_reason: reason })
    .eq("certificate_id", id)
    .is("revoked_at", null)
    .select("certificate_id")
    .maybeSingle();

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!data) {
    return Response.json(
      { ok: false, error: "Certificate not found, or already revoked." },
      { status: 404 },
    );
  }

  return Response.json({ ok: true, certificateId: data.certificate_id });
}
