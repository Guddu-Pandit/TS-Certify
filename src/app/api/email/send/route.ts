import { requireApiUser } from "@/lib/auth";
import { sendCertificateEmails } from "@/lib/email/send";

// nodemailer needs Node APIs.
export const runtime = "nodejs";
export const maxDuration = 60;

/** Body: { certificateIds: string[] } — human-readable ids like TS-2026-0001. */
export async function POST(request: Request) {
  const { error: authError } = await requireApiUser();
  if (authError) return authError;

  let body: { certificateIds?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Expected a JSON body." }, { status: 400 });
  }

  const ids = Array.isArray(body.certificateIds)
    ? body.certificateIds.filter((v): v is string => typeof v === "string")
    : [];

  if (ids.length === 0) {
    return Response.json({ ok: false, error: "No certificates selected." }, { status: 400 });
  }
  if (ids.length > 25) {
    // The transport is rate limited to ~3/second, so 25 takes about 9
    // seconds — comfortably inside the function timeout.
    return Response.json(
      { ok: false, error: "Send at most 25 emails per request." },
      { status: 400 },
    );
  }

  try {
    return Response.json(await sendCertificateEmails(ids));
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "Sending failed." },
      { status: 500 },
    );
  }
}
