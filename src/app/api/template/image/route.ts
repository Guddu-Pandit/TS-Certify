import fs from "node:fs";
import path from "node:path";
import { requireApiUser } from "@/lib/auth";
import { TEMPLATE } from "@/config/template";

export const runtime = "nodejs";

/**
 * Serves the raw template image to the calibrator page.
 *
 * The file lives in assets/, not public/, precisely so it is NOT world
 * readable — your certificate artwork is the thing a forger would want. This
 * route hands it out only to signed-in staff.
 */
export async function GET() {
  const { error: authError } = await requireApiUser();
  if (authError) return authError;

  const abs = path.join(process.cwd(), TEMPLATE.file);
  if (!fs.existsSync(abs)) {
    return Response.json(
      { ok: false, error: `Template not found at ${TEMPLATE.file}.` },
      { status: 404 },
    );
  }

  const file = fs.readFileSync(abs);
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": TEMPLATE.file.endsWith(".png") ? "image/png" : "image/jpeg",
      "Cache-Control": "no-store",
    },
  });
}
