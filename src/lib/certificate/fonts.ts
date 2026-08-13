import { GlobalFonts } from "@napi-rs/canvas";
import path from "node:path";
import fs from "node:fs";

/**
 * Registers the certificate fonts, exactly once per process.
 *
 * Two things here are load-bearing:
 *
 * 1. An EXPLICIT ALIAS is passed to registerFromPath. `ctx.font` matches on
 *    the font's internal family name, which frequently is not the filename.
 *    Forcing the alias means "80px Montserrat-Bold" resolves to the file we
 *    intend rather than silently falling back to a system font.
 *
 * 2. ONE FILE PER WEIGHT, each under its own alias. @napi-rs/canvas ignores
 *    the weight axis of variable fonts — measured directly: registering the
 *    variable Montserrat and asking for "400 80px" vs "700 80px" returned
 *    identical widths. Bold would have rendered as regular, with no error.
 *
 * Registering per request would leak font handles across warm serverless
 * invocations, hence the module-level guard.
 */
const FONT_FILES: Record<string, string> = {
  "Montserrat-Regular": "assets/fonts/Montserrat-Regular.woff2",
  "Montserrat-Bold": "assets/fonts/Montserrat-Bold.woff2",
  GreatVibes: "assets/fonts/GreatVibes-Regular.ttf",
};

let registered = false;

export function registerFonts(): void {
  if (registered) return;

  const missing: string[] = [];

  for (const [alias, relative] of Object.entries(FONT_FILES)) {
    const abs = path.join(process.cwd(), relative);
    if (!fs.existsSync(abs)) {
      missing.push(relative);
      continue;
    }
    GlobalFonts.registerFromPath(abs, alias);
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing font file(s): ${missing.join(", ")}.\n` +
        `On Vercel this usually means outputFileTracingIncludes in next.config.ts ` +
        `is not covering assets/ for this route.`,
    );
  }

  registered = true;
}
