/**
 * Generates assets/templates/certificate-achievement.png — the black-and-gold
 * "Certificate of Achievement" artwork.
 *
 * Run with:  npm run make:template
 *
 * This draws ONLY the static artwork. Every value that changes per recipient
 * (name, domain, dates, ID, QR) is painted at render time from the coordinates
 * in src/config/template.ts — so the two files have to agree, and the y-values
 * quoted in the comments below are the ones that file expects.
 *
 * Optional real logos: drop either of these in and they replace the drawn
 * fallbacks automatically, no code change needed.
 *   assets/templates/logo-techsynergy.png   (top right, fitted to 620x230)
 *   assets/templates/logo-msme.png          (bottom left, fitted to 240x240)
 */
import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";

// A4 landscape at 300dpi — high enough that printed text stays crisp.
const W = 3508;
const H = 2480;

const INK = "#1b1b1f"; // near-black used for the corner blocks and headings
const GOLD_DARK = "#b07c1d";
const GOLD_MID = "#f2d06b";
const GOLD_LIGHT = "#fff0b8";
const GREY_SHARD = "#ececec";
const GREY_SHARD_2 = "#f5f5f5";

GlobalFonts.registerFromPath("assets/fonts/Montserrat-Regular.woff2", "Montserrat-Regular");
GlobalFonts.registerFromPath("assets/fonts/Montserrat-Bold.woff2", "Montserrat-Bold");
GlobalFonts.registerFromPath("assets/fonts/GreatVibes-Regular.ttf", "GreatVibes");

const canvas = createCanvas(W, H);
const ctx = canvas.getContext("2d");

/** Gold that reads as metal rather than mustard: light in the middle, dark at the edges. */
function goldGradient(x0, y0, x1, y1) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, GOLD_DARK);
  g.addColorStop(0.35, GOLD_MID);
  g.addColorStop(0.55, GOLD_LIGHT);
  g.addColorStop(0.75, GOLD_MID);
  g.addColorStop(1, GOLD_DARK);
  return g;
}

function polygon(points, fill) {
  ctx.save();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (const [x, y] of points.slice(1)) ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Draws letter-spaced text. Canvas has no tracking control, and the design
 * leans on wide tracking for the headings, so each glyph is placed by hand.
 */
function tracked(text, cx, y, { font, size, color, spacing = 0, align = "center" }) {
  ctx.font = `${size}px ${font}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = color;

  const chars = [...text];
  const width =
    chars.reduce((sum, ch) => sum + ctx.measureText(ch).width, 0) + spacing * (chars.length - 1);

  let x = align === "center" ? cx - width / 2 : align === "right" ? cx - width : cx;
  for (const ch of chars) {
    ctx.fillText(ch, x, y);
    x += ctx.measureText(ch).width + spacing;
  }
  return width;
}

function centred(text, cx, y, { font, size, color }) {
  ctx.font = `${size}px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = color;
  ctx.fillText(text, cx, y);
}

// ---------------------------------------------------------------------------
// Background: dark page, white card floating on it
// ---------------------------------------------------------------------------
ctx.fillStyle = "#0f0f12";
ctx.fillRect(0, 0, W, H);

const CARD = { x: 96, y: 96, w: W - 192, h: H - 192 };
ctx.fillStyle = "#ffffff";
ctx.fillRect(CARD.x, CARD.y, CARD.w, CARD.h);

// Pale diagonal shards, top-right and bottom-left. They sit under everything
// else and stop the white card from reading as empty paper.
polygon(
  [
    [CARD.x + CARD.w - 1250, CARD.y],
    [CARD.x + CARD.w, CARD.y],
    [CARD.x + CARD.w, CARD.y + 900],
  ],
  GREY_SHARD_2,
);
polygon(
  [
    [CARD.x + CARD.w - 800, CARD.y],
    [CARD.x + CARD.w, CARD.y],
    [CARD.x + CARD.w, CARD.y + 560],
  ],
  GREY_SHARD,
);
polygon(
  [
    [CARD.x, CARD.y + CARD.h - 900],
    [CARD.x + 1250, CARD.y + CARD.h],
    [CARD.x, CARD.y + CARD.h],
  ],
  GREY_SHARD_2,
);
polygon(
  [
    [CARD.x, CARD.y + CARD.h - 560],
    [CARD.x + 800, CARD.y + CARD.h],
    [CARD.x, CARD.y + CARD.h],
  ],
  GREY_SHARD,
);

// ---------------------------------------------------------------------------
// Corner ornament — drawn once in top-left coordinates, then mirrored through
// the centre for the bottom-right. Mirroring rather than re-deriving the
// numbers is what keeps the two corners actually symmetrical.
// ---------------------------------------------------------------------------
function cornerOrnament(ox, oy) {
  ctx.save();
  ctx.translate(ox, oy);

  // Outer black chevron hugging the corner.
  polygon(
    [
      [0, 0],
      [900, 0],
      [640, 250],
      [250, 250],
      [250, 640],
      [0, 900],
    ],
    INK,
  );

  // Gold chevron nested inside it.
  polygon(
    [
      [330, 330],
      [880, 330],
      [740, 460],
      [460, 460],
      [460, 740],
      [330, 880],
    ],
    goldGradient(330, 330, 880, 880),
  );

  // Small solid black wedge inside the gold, for the layered look.
  polygon(
    [
      [560, 560],
      [980, 560],
      [560, 980],
    ],
    INK,
  );

  ctx.restore();
}

cornerOrnament(CARD.x, CARD.y);

ctx.save();
ctx.translate(W, H);
ctx.rotate(Math.PI);
cornerOrnament(CARD.x, CARD.y);
ctx.restore();

// Gold rails, top and bottom. The top one is interrupted by the corner block,
// so it starts clear of it.
ctx.fillStyle = goldGradient(CARD.x + 600, 0, CARD.x + CARD.w, 0);
ctx.fillRect(CARD.x + 620, CARD.y + 130, CARD.w - 900, 34);
ctx.fillStyle = goldGradient(CARD.x, 0, CARD.x + CARD.w - 600, 0);
ctx.fillRect(CARD.x + 280, CARD.y + CARD.h - 164, CARD.w - 900, 34);

// ---------------------------------------------------------------------------
// Brand mark, top right
// ---------------------------------------------------------------------------
const LOGO_TS = "assets/templates/logo-techsynergy.png";
if (existsSync(LOGO_TS)) {
  const logo = await loadImage(readFileSync(LOGO_TS));
  const box = { w: 620, h: 230 };
  const scale = Math.min(box.w / logo.width, box.h / logo.height);
  const w = logo.width * scale;
  const h = logo.height * scale;
  ctx.drawImage(logo, 2980 - w / 2, 330 - h / 2, w, h);
} else {
  tracked("TECH-SYNERGY", 2980, 350, {
    font: "Montserrat-Bold",
    size: 84,
    color: INK,
    spacing: 2,
  });
  ctx.fillStyle = goldGradient(2760, 0, 3200, 0);
  ctx.fillRect(2760, 385, 440, 8);
  tracked("SERVICES", 2980, 460, {
    font: "Montserrat-Regular",
    size: 46,
    color: GOLD_DARK,
    spacing: 26,
  });
}

// ---------------------------------------------------------------------------
// Headings
// ---------------------------------------------------------------------------
tracked("CERTIFICATE", W / 2, 640, {
  font: "Montserrat-Bold",
  size: 190,
  color: INK,
  spacing: 26,
});
tracked("OF ACHIEVEMENT", W / 2, 790, {
  font: "Montserrat-Regular",
  size: 88,
  color: "#3a3a3a",
  spacing: 14,
});
tracked("THIS CERTIFICATE IS PROUDLY PRESENTED TO", W / 2, 1010, {
  font: "Montserrat-Bold",
  size: 56,
  color: INK,
  spacing: 8,
});

// Gold rule under the recipient's name. The name baseline (1250) is set in
// src/config/template.ts; this rule sits far enough below to clear descenders
// of the script face.
ctx.fillStyle = goldGradient(880, 0, 2620, 0);
ctx.fillRect(880, 1330, 1740, 10);

// ---------------------------------------------------------------------------
// Body copy. The first line is fixed; the course and the dates underneath it
// are painted per certificate (domain at 1500, duration at 1620).
// ---------------------------------------------------------------------------
centred("This certificate is awarded for successfully completing the", W / 2, 1440, {
  font: "Montserrat-Regular",
  size: 60,
  color: "#3a3a3a",
});
centred(
  "demonstrating commitment towards self-growth and professional development",
  W / 2,
  1740,
  { font: "Montserrat-Regular", size: 52, color: "#5c5c5c" },
);

// ---------------------------------------------------------------------------
// Signature blocks. Left and right of the seal, deliberately left blank above
// the rule so a real signature image can be dropped on top.
// ---------------------------------------------------------------------------
function signatureBlock(cx, title, subtitle) {
  ctx.fillStyle = "#2b2b2b";
  ctx.fillRect(cx - 420, 1900, 840, 5);
  tracked(title, cx, 1990, {
    font: "Montserrat-Bold",
    size: 56,
    color: INK,
    spacing: 4,
  });
  centred(subtitle, cx, 2070, {
    font: "Montserrat-Regular",
    size: 48,
    color: "#4a4a4a",
  });
}

signatureBlock(1090, "DIRECTOR", "Head of TECH-SYNERGY");
signatureBlock(2418, "TEAM MANAGER", "Head of Event");

// ---------------------------------------------------------------------------
// Gold seal, centred between the two signatures
// ---------------------------------------------------------------------------
function seal(cx, cy, r) {
  // Ribbon tails first, so the medallion overlaps them.
  polygon(
    [
      [cx - r * 0.55, cy + r * 0.55],
      [cx - r * 0.1, cy + r * 0.75],
      [cx - r * 0.2, cy + r * 1.75],
      [cx - r * 0.62, cy + r * 1.35],
      [cx - r * 0.95, cy + r * 1.6],
    ],
    "#8c5a12",
  );
  polygon(
    [
      [cx + r * 0.55, cy + r * 0.55],
      [cx + r * 0.1, cy + r * 0.75],
      [cx + r * 0.2, cy + r * 1.75],
      [cx + r * 0.62, cy + r * 1.35],
      [cx + r * 0.95, cy + r * 1.6],
    ],
    "#b07c1d",
  );

  // Scalloped outer edge.
  ctx.save();
  ctx.fillStyle = goldGradient(cx - r, cy - r, cx + r, cy + r);
  ctx.beginPath();
  const teeth = 28;
  for (let i = 0; i < teeth * 2; i++) {
    const angle = (Math.PI * i) / teeth;
    const radius = i % 2 === 0 ? r : r * 0.9;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  // Inner disc, lit from the top left.
  const disc = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r * 0.85);
  disc.addColorStop(0, GOLD_LIGHT);
  disc.addColorStop(0.55, GOLD_MID);
  disc.addColorStop(1, GOLD_DARK);
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(140, 90, 18, 0.55)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

seal(W / 2, 1890, 165);

// ---------------------------------------------------------------------------
// Footer marks
// ---------------------------------------------------------------------------
const LOGO_MSME = "assets/templates/logo-msme.png";
if (existsSync(LOGO_MSME)) {
  const logo = await loadImage(readFileSync(LOGO_MSME));
  const scale = Math.min(240 / logo.width, 240 / logo.height);
  const w = logo.width * scale;
  const h = logo.height * scale;
  ctx.drawImage(logo, 460 - w / 2, 2120 - h / 2, w, h);
} else {
  tracked("MSME", 460, 2130, {
    font: "Montserrat-Bold",
    size: 62,
    color: "#6b6b6b",
    spacing: 10,
  });
  centred("REGISTERED", 460, 2190, {
    font: "Montserrat-Regular",
    size: 34,
    color: "#8a8a8a",
  });
}

// "Scan to verify" label under the QR block. The QR itself is drawn by the
// renderer at 2990,1960 (280px) — see TEMPLATE.qr.
centred("Scan to verify", 3130, 2320, {
  font: "Montserrat-Regular",
  size: 36,
  color: "#8a8a8a",
});

mkdirSync("assets/templates", { recursive: true });
writeFileSync("assets/templates/certificate-achievement.png", canvas.toBuffer("image/png"));
console.log(`Wrote assets/templates/certificate-achievement.png (${W}x${H})`);
