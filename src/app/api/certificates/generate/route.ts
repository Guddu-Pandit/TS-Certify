import { requireApiUser } from "@/lib/auth";
import { generateCertificates } from "@/lib/certificate/generate";

// @napi-rs/canvas is a native module; the Edge runtime cannot load it.
export const runtime = "nodejs";
// Each render takes 1-2s. The client caps batches so this is not hit.
export const maxDuration = 60;

/**
 * Generates certificates for one or more submissions.
 *
 * Body: { submissionIds: string[], force?: boolean }
 *   force=false (default) skips submissions that already have an active
 *   certificate, making double-clicks and repeated bulk runs harmless.
 *   force=true is what the explicit Re-generate action sends.
 */
export async function POST(request: Request) {
  const { error: authError } = await requireApiUser();
  if (authError) return authError;

  let body: { submissionIds?: unknown; force?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Expected a JSON body." }, { status: 400 });
  }

  const ids = Array.isArray(body.submissionIds)
    ? body.submissionIds.filter((v): v is string => typeof v === "string")
    : [];

  if (ids.length === 0) {
    return Response.json({ ok: false, error: "No submissions selected." }, { status: 400 });
  }
  if (ids.length > 15) {
    // Renders are sequential and memory-heavy; a larger batch risks the
    // function timeout. The client loops in chunks instead.
    return Response.json(
      { ok: false, error: "Generate at most 15 certificates per request." },
      { status: 400 },
    );
  }

  try {
    const summary = await generateCertificates(ids, { force: body.force === true });
    return Response.json(summary);
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "Generation failed." },
      { status: 500 },
    );
  }
}
