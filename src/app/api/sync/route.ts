import { requireApiUser } from "@/lib/auth";
import { syncFromSheet } from "@/lib/sheets/sync";

// googleapis needs Node APIs; the Edge runtime cannot run it.
export const runtime = "nodejs";
export const maxDuration = 60;

/** Pulls the Google Sheet into `submissions`. Both admin and hr may run it. */
export async function POST() {
  const { error: authError } = await requireApiUser();
  if (authError) return authError;

  try {
    const result = await syncFromSheet();
    return Response.json(result, { status: result.ok ? 200 : 500 });
  } catch (err) {
    // readSheet() already converts Google's errors into actionable advice.
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "Sync failed." },
      { status: 500 },
    );
  }
}
