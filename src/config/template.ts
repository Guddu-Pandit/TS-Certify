/**
 * ============================================================================
 *  CERTIFICATE LAYOUT — every coordinate lives here and nowhere else
 * ============================================================================
 *
 * Coordinates are in TEMPLATE PIXELS, measured on the image itself. `y` is the
 * text BASELINE, not the top of the glyphs.
 *
 * ---------------------------------------------------------------------------
 * WHEN YOUR REAL CERTIFICATE DESIGN ARRIVES:
 *
 *   1. Save it as assets/templates/certificate.png
 *   2. Set `width` and `height` below to its exact pixel dimensions.
 *      The renderer refuses to run on a mismatch rather than producing a
 *      subtly misaligned certificate.
 *   3. Open /admin/template — click where each field belongs and it reports
 *      the exact numbers to paste in here.
 *   4. Run `npm run render:sample` to see the result in seconds, with no
 *      database and no server involved.
 * ---------------------------------------------------------------------------
 */

export type FontName = "Montserrat-Regular" | "Montserrat-Bold" | "GreatVibes";

export interface TextField {
  x: number;
  y: number;
  align: "left" | "center" | "right";
  font: FontName;
  size: number;
  color: string;
  /** Shrink (then wrap) to stay inside this width. */
  maxWidth?: number;
  /** Never shrink below this before wrapping instead. */
  minSize?: number;
  /** Allow a second line when shrinking is not enough. Names only. */
  wrap?: boolean;
  uppercase?: boolean;
  letterSpacing?: number;
}

export const TEMPLATE = {
  /** Recorded on each certificate row, so you can tell which layout produced it. */
  key: "default-v1",
  file: "assets/templates/certificate.png",

  /** MUST match the image exactly. A4 landscape at 300dpi. */
  width: 3508,
  height: 2480,

  fields: {
    fullName: {
      x: 1754,
      y: 1190,
      align: "center",
      font: "GreatVibes",
      size: 190,
      color: "#12284c",
      maxWidth: 2000,
      minSize: 90,
      wrap: true,
    },
    domain: {
      x: 1754,
      y: 1500,
      align: "center",
      font: "Montserrat-Bold",
      size: 80,
      color: "#12284c",
      maxWidth: 2200,
      minSize: 44,
    },
    duration: {
      x: 1754,
      y: 1640,
      align: "center",
      font: "Montserrat-Regular",
      size: 52,
      color: "#4a4a4a",
      maxWidth: 2400,
      minSize: 34,
    },
    institution: {
      x: 1754,
      y: 1760,
      align: "center",
      font: "Montserrat-Regular",
      size: 46,
      color: "#6b6b6b",
      maxWidth: 2400,
      minSize: 30,
    },
    issuedOn: {
      x: 820,
      y: 2030,
      align: "center",
      font: "Montserrat-Regular",
      size: 48,
      color: "#333333",
      maxWidth: 700,
    },
    certificateId: {
      x: 260,
      y: 2285,
      align: "left",
      font: "Montserrat-Regular",
      size: 34,
      color: "#8a8a8a",
      maxWidth: 900,
    },
  } satisfies Record<string, TextField>,

  qr: {
    x: 3020,
    y: 1950,
    size: 340,
    /** Quiet-zone modules. Below ~2 some scanners struggle. */
    margin: 2,
    dark: "#12284c",
    light: "#ffffff",
  },

  /**
   * Which fields actually get printed. Drop one from this list to leave it off
   * the certificate without deleting its coordinates.
   */
  print: ["fullName", "domain", "duration", "issuedOn", "certificateId"] as const,
} as const;

export type TemplateFieldKey = keyof typeof TEMPLATE.fields;
