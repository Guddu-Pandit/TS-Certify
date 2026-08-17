import { createCanvas, loadImage } from "@napi-rs/canvas";
import path from "node:path";
import fs from "node:fs";
import {
  applyTokens,
  TEMPLATE,
  type Layout,
  type TokenValues,
} from "@/config/template";
import { appEnv } from "@/config/env";
import { registerFonts } from "./fonts";
import { drawField } from "./text";
import { certificateQr } from "./qr";
import { loadLayout } from "./layout";
import { durationSentence, formatDate } from "@/lib/dates";

export interface CertificateData {
  certificateId: string;
  fullName: string;
  domain: string | null;
  institution: string | null;
  startDate: string | null;
  endDate: string | null;
  issuedOn: string | Date;
}

/** Loaded once — re-reading the template PNG on every request is pure waste. */
let templateCache: { buffer: Buffer; width: number; height: number } | null = null;

async function loadTemplate() {
  if (templateCache) return templateCache;

  const abs = path.join(process.cwd(), TEMPLATE.file);
  if (!fs.existsSync(abs)) {
    throw new Error(
      `Certificate template not found at ${TEMPLATE.file}.\n` +
        `Put the artwork there — the renderer never modifies it, it only draws on top.`,
    );
  }

  const buffer = fs.readFileSync(abs);
  const img = await loadImage(buffer);

  // Refuse to render on a size mismatch. Every coordinate in the layout is
  // measured against these dimensions, so a differently-sized image would
  // place every field in the wrong spot — and would do it silently, producing
  // plausible-looking but wrong certificates.
  if (img.width !== TEMPLATE.width || img.height !== TEMPLATE.height) {
    throw new Error(
      `Template size mismatch.\n` +
        `  Image  : ${img.width} x ${img.height}\n` +
        `  Config : ${TEMPLATE.width} x ${TEMPLATE.height}\n\n` +
        `Set width/height in src/config/template.ts to the image's real size, ` +
        `then re-position the fields at /admin/template.`,
    );
  }

  templateCache = { buffer, width: img.width, height: img.height };
  return templateCache;
}

/** Everything a field's `text` may reference. */
export function tokenValues(data: CertificateData): TokenValues {
  const name = data.fullName;

  return {
    name,
    firstName: name.trim().split(/\s+/)[0] ?? name,
    domain: data.domain ?? "",
    // One function decides this wording, so changing it changes the
    // certificate and the email together.
    duration: durationSentence(data.startDate, data.endDate),
    startDate: formatDate(data.startDate),
    endDate: formatDate(data.endDate),
    institution: data.institution ?? "",
    certificateId: data.certificateId,
    issuedOn: formatDate(data.issuedOn),
    orgName: appEnv().ORG_NAME,
  };
}

export interface RenderResult {
  png: Buffer;
  /** Fields that had to be shrunk, wrapped or clipped — surfaced in previews. */
  adjustedFields: string[];
}

/**
 * Composites one certificate: artwork, then text, then the QR code.
 *
 * `layout` is normally omitted, in which case the saved layout is read from
 * the database (falling back to the code defaults). The editor passes an
 * explicit one so it can preview changes that have not been saved yet.
 *
 * Callers must invoke this SEQUENTIALLY when generating in bulk. Each canvas
 * holds a full RGBA bitmap, so running renders in parallel will exhaust a
 * serverless function's memory.
 */
export async function renderCertificate(
  data: CertificateData,
  layout?: Layout,
): Promise<RenderResult> {
  registerFonts();
  const template = await loadTemplate();
  const active = layout ?? (await loadLayout());

  const canvas = createCanvas(TEMPLATE.width, TEMPLATE.height);
  const ctx = canvas.getContext("2d");

  const background = await loadImage(template.buffer);
  ctx.drawImage(background, 0, 0, TEMPLATE.width, TEMPLATE.height);

  const values = tokenValues(data);
  const adjustedFields: string[] = [];

  for (const field of active.fields) {
    if (!field.enabled) continue;

    const value = applyTokens(field.text, values).trim();
    if (!value || allTokensBlank(field.text, values)) continue;

    const drawn = drawField(ctx, field, value);
    if (drawn?.adjusted) adjustedFields.push(field.key);
  }

  if (active.qr.enabled) {
    const qrPng = await certificateQr(data.certificateId, active.qr);
    const qr = await loadImage(qrPng);
    ctx.drawImage(qr, active.qr.x, active.qr.y, active.qr.size, active.qr.size);
  }

  return { png: canvas.toBuffer("image/png"), adjustedFields };
}

/**
 * True when a field's text references tokens and every one of them came back
 * empty — "Issued on {{issuedOn}}" with no date must not print a stranded
 * "Issued on". A caption made only of literal text has no tokens, so it always
 * prints.
 */
function allTokensBlank(text: string, values: TokenValues): boolean {
  const tokens = [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]);
  const known = tokens.filter((t) => t in values);
  return known.length > 0 && known.every((t) => !values[t as keyof TokenValues].trim());
}
