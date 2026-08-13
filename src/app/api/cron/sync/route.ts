import { appEnv } from "@/config/env";
import { syncFromSheet } from "@/lib/sheets/sync";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Scheduled sync, for a Vercel Cron entry.
 *
 * Exempt from the auth proxy (there is no user session on a cron request), so
 * it authorises itself with CRON_SECRET instead. If that is not configured the
 * route stays closed rather than falling open.
 */
export async function GET(request: Request) {
  const { CRON_SECRET } = appEnv();

  if (!CRON_SECRET) {
    return Response.json(
      { ok: false, error: "CRON_SECRET is not set, so scheduled sync is disabled." },
      { status: 503 },
    );
  }

  const provided = request.headers.get("authorization");
  if (provided !== `Bearer ${CRON_SECRET}`) {
    return Response.json({ ok: false, error: "Unauthorised." }, { status: 401 });
  }

  try {
    const result = await syncFromSheet();
    return Response.json(result, { status: result.ok ? 200 : 500 });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "Sync failed." },
      { status: 500 },
    );
  }
}
