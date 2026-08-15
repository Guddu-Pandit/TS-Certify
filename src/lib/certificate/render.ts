import { createCanvas, loadImage } from "@napi-rs/canvas";
import path from "node:path";
import fs from "node:fs";
import { TEMPLATE, type TemplateFieldKey } from "@/config/template";
import { registerFonts } from "./fonts";
import { drawField } from "./text";
import { certificateQr } from "./qr";
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

/** Loaded once — re-reading a 3.5k-pixel PNG on every request is pure waste. */
let templateCache: { buffer: Buffer; width: number; height: number } | null = null;

async function loadTemplate() {
  if (templateCache) return templateCache;

  const abs = path.join(process.cwd(), TEMPLATE.file);
  if (!fs.existsSync(abs)) {
    throw new Error(
      `Certificate template not found at ${TEMPLATE.file}.\n` +
        `Put your design there, or run \`npm run make:template\` to regenerate it.`,
    );
  }

  const buffer = fs.readFileSync(abs);
  const img = await loadImage(buffer);

  // Refuse to render on a size mismatch. Every coordinate in template.ts is
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

/** Values for each printable field, derived from the certificate data. */
function fieldValues(data: CertificateData): Record<TemplateFieldKey, string> {
  return {
    fullName: data.fullName,
    domain: data.domain ?? "",
    duration: durationSentence(data.startDate, data.endDate),
    institution: data.institution ?? "",
    issuedOn: formatDate(data.issuedOn),
    certificateId: `Certificate ID: ${data.certificateId}`,
  };
}

export interface RenderResult {
  png: Buffer;
  /** Fields that had to be shrunk, wrapped or clipped — surfaced in previews. */
  adjustedFields: string[];
}

/**
 * Composites one certificate: template image, then text, then the QR code.
 *
 * Callers must invoke this SEQUENTIALLY when generating in bulk. Each canvas
 * holds a full RGBA bitmap — roughly 35MB at 3508x2480 — so running renders in
 * parallel will exhaust a 1GB serverless function's memory.
 */
export async function renderCertificate(data: CertificateData): Promise<RenderResult> {
  registerFonts();
  const template = await loadTemplate();

  const canvas = createCanvas(TEMPLATE.width, TEMPLATE.height);
  const ctx = canvas.getContext("2d");

  const background = await loadImage(template.buffer);
  ctx.drawImage(background, 0, 0, TEMPLATE.width, TEMPLATE.height);

  const values = fieldValues(data);
  const adjustedFields: string[] = [];

  for (const key of TEMPLATE.print) {
    const field = TEMPLATE.fields[key];
    const value = values[key];
    if (!value) continue;

    const drawn = drawField(ctx, field, value);
    if (drawn?.adjusted) adjustedFields.push(key);
  }

  const qrPng = await certificateQr(data.certificateId);
  const qr = await loadImage(qrPng);
  ctx.drawImage(qr, TEMPLATE.qr.x, TEMPLATE.qr.y, TEMPLATE.qr.size, TEMPLATE.qr.size);

  return { png: canvas.toBuffer("image/png"), adjustedFields };
}
