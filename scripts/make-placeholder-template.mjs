/**
 * Generates assets/templates/certificate.png — a plain placeholder so the
 * renderer has something to draw on before your real artwork arrives.
 *
 * Run with:  node scripts/make-placeholder-template.mjs
 *
 * Replace assets/templates/certificate.png with your own design when ready,
 * then update width/height in src/config/template.ts to match it exactly and
 * re-position the fields using /admin/template.
 */
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { writeFileSync, mkdirSync } from "node:fs";

// A4 landscape at 300dpi — high enough that printed text stays crisp.
const W = 3508;
const H = 2480;

GlobalFonts.registerFromPath("assets/fonts/Montserrat-Regular.woff2", "Montserrat-Regular");
GlobalFonts.registerFromPath("assets/fonts/Montserrat-Bold.woff2", "Montserrat-Bold");

const canvas = createCanvas(W, H);
const ctx = canvas.getContext("2d");

ctx.fillStyle = "#fdfcf8";
ctx.fillRect(0, 0, W, H);

// Double border
ctx.strokeStyle = "#12284c";
ctx.lineWidth = 18;
ctx.strokeRect(90, 90, W - 180, H - 180);
ctx.strokeStyle = "#c8a04a";
ctx.lineWidth = 6;
ctx.strokeRect(140, 140, W - 280, H - 280);

// Corner accents
ctx.fillStyle = "#c8a04a";
for (const [cx, cy] of [
  [140, 140],
  [W - 140, 140],
  [140, H - 140],
  [W - 140, H - 140],
]) {
  ctx.beginPath();
  ctx.arc(cx, cy, 26, 0, Math.PI * 2);
  ctx.fill();
}

ctx.textAlign = "center";
ctx.fillStyle = "#12284c";
ctx.font = "150px Montserrat-Bold";
ctx.fillText("CERTIFICATE", W / 2, 560);

ctx.font = "62px Montserrat-Regular";
ctx.fillStyle = "#7a6a45";
ctx.fillText("O F   C O M P L E T I O N", W / 2, 680);

ctx.font = "58px Montserrat-Regular";
ctx.fillStyle = "#555555";
ctx.fillText("This is to certify that", W / 2, 980);
ctx.fillText("has successfully completed the internship in", W / 2, 1330);

// Name rule
ctx.strokeStyle = "#d8d2c2";
ctx.lineWidth = 4;
ctx.beginPath();
ctx.moveTo(W / 2 - 1050, 1225);
ctx.lineTo(W / 2 + 1050, 1225);
ctx.stroke();

// Signature lines
ctx.lineWidth = 4;
ctx.strokeStyle = "#999999";
for (const x of [820, W - 820]) {
  ctx.beginPath();
  ctx.moveTo(x - 380, 2075);
  ctx.lineTo(x + 380, 2075);
  ctx.stroke();
}
ctx.font = "44px Montserrat-Regular";
ctx.fillStyle = "#777777";
ctx.fillText("Date of Issue", 820, 2160);
ctx.fillText("Authorised Signatory", W - 820, 2160);

// Marker for where the QR block goes, so the placeholder shows the layout.
ctx.strokeStyle = "#dddddd";
ctx.setLineDash([16, 16]);
ctx.lineWidth = 4;
ctx.strokeRect(3020, 1640, 340, 340);
ctx.setLineDash([]);

mkdirSync("assets/templates", { recursive: true });
writeFileSync("assets/templates/certificate.png", canvas.toBuffer("image/png"));
console.log(`Wrote assets/templates/certificate.png (${W}x${H})`);
