/**
 * ============================================================================
 *  CERTIFICATE LAYOUT — the artwork, and the DEFAULT position of every field
 * ============================================================================
 *
 * Two halves, deliberately separated:
 *
 *   TEMPLATE       the artwork file and its exact pixel size. Code-level, and
 *                  the renderer refuses to run if the image does not match —
 *                  every coordinate below is measured against these numbers.
 *
 *   DEFAULT_LAYOUT where each field sits, what it prints, and how it looks.
 *                  This is only the STARTING POINT: staff move fields, add and
 *                  remove them at /admin/template, and the saved result lives
 *                  in public.certificate_layouts. The database wins when a row
 *                  exists; this file is the fallback and the "Reset" target.
 *
 * Coordinates are in TEMPLATE PIXELS measured on the image itself, and `y` is
 * the text BASELINE, not the top of the glyphs.
 *
 * The current artwork already prints its own labels ("Duration:",
 * "CERTIFICATE ID :", the body paragraph), so the defaults here place values
 * next to those labels rather than repeating them. Nothing in the image is
 * edited by the renderer — it is composited underneath, untouched.
 */

export type FontName = "Montserrat-Regular" | "Montserrat-Bold" | "GreatVibes";
export type Align = "left" | "center" | "right";

export const FONT_NAMES: FontName[] = ["Montserrat-Regular", "Montserrat-Bold", "GreatVibes"];
export const ALIGNS: Align[] = ["left", "center", "right"];

/** One line of text painted on the certificate. */
export interface LayoutField {
  /** Stable id. Unique within a layout; also the marker label in the editor. */
  key: string;
  /** Human name shown in the editor. */
  label: string;
  /** What gets printed — literal text mixed with {{tokens}} (see TOKENS). */
  text: string;
  x: number;
  y: number;
  align: Align;
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
  /** Off keeps the field and its position but leaves it off the certificate. */
  enabled: boolean;
}

export interface QrBox {
  x: number;
  y: number;
  size: number;
  /** Quiet-zone modules. Below ~2 some scanners struggle. */
  margin: number;
  dark: string;
  light: string;
  enabled: boolean;
}

export interface Layout {
  fields: LayoutField[];
  qr: QrBox;
}

/**
 * Values a field's `text` can reference. Same idea as the email editor's
 * placeholders, and shown as clickable chips in the layout editor, so this
 * list is the single source of truth for both substitution and the UI.
 */
export const TOKENS = [
  { token: "name", description: "Full name" },
  { token: "firstName", description: "First word of their name" },
  { token: "domain", description: "Internship domain" },
  { token: "duration", description: "e.g. 8 Weeks (12 Jan 2026 to 09 Mar 2026)" },
  { token: "startDate", description: "Start date" },
  { token: "endDate", description: "End date" },
  { token: "institution", description: "School or college" },
  { token: "certificateId", description: "e.g. TS-2026-0001" },
  { token: "issuedOn", description: "Date the certificate was issued" },
  { token: "orgName", description: "Your organisation name (from ORG_NAME)" },
] as const;

export type TokenName = (typeof TOKENS)[number]["token"];
export type TokenValues = Record<TokenName, string>;

/**
 * Substitutes {{token}} occurrences. Unknown tokens are left visible on
 * purpose — a typo shows up on the preview rather than silently printing a
 * blank line. Pure, so the browser editor can preview the same result.
 */
export function applyTokens(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (whole, token: string) =>
    token in values ? values[token] : whole,
  );
}

export const TEMPLATE = {
  /** Recorded on each certificate row, so you can tell which artwork produced it. */
  key: "ts-completion-v2",
  file: "assets/templates/certificate2.png",

  /** MUST match the image exactly. */
  width: 2000,
  height: 1414,
} as const;

export const DEFAULT_LAYOUT: Layout = {
  fields: [
    {
      key: "fullName",
      label: "Recipient name",
      text: "{{name}}",
      // The blank band between "This certificate is presented to:" and
      // "Duration:" — measured on the artwork as y 590–780.
      x: 1000,
      y: 720,
      align: "center",
      font: "GreatVibes",
      size: 130,
      color: "#c9a227",
      maxWidth: 1150,
      minSize: 60,
      wrap: true,
      enabled: true,
    },
    {
      key: "duration",
      label: "Duration",
      text: "{{duration}}",
      // Sits to the right of the printed "Duration:" label, which ends at
      // x=858 on the baseline y=809.
      x: 880,
      y: 809,
      align: "left",
      font: "Montserrat-Regular",
      size: 34,
      color: "#24384a",
      maxWidth: 780,
      minSize: 24,
      enabled: true,
    },
    {
      key: "certificateId",
      label: "Certificate ID",
      text: "{{certificateId}}",
      // Right of the printed "CERTIFICATE ID :" label, which ends at x=586.
      x: 604,
      y: 1360,
      align: "left",
      font: "Montserrat-Bold",
      size: 30,
      color: "#24384a",
      maxWidth: 520,
      minSize: 22,
      enabled: true,
    },
    {
      key: "issuedOn",
      label: "Issue date",
      text: "Issued on {{issuedOn}}",
      x: 1400,
      y: 1360,
      align: "right",
      font: "Montserrat-Regular",
      size: 30,
      color: "#5b6b7a",
      maxWidth: 600,
      minSize: 22,
      enabled: true,
    },
    {
      key: "verifyNote",
      label: "QR caption",
      text: "Scan to verify",
      x: 345,
      y: 1225,
      align: "center",
      font: "Montserrat-Regular",
      size: 26,
      color: "#5b6b7a",
      maxWidth: 300,
      enabled: true,
    },
    {
      key: "domain",
      label: "Domain",
      text: "{{domain}}",
      // Off by default: the printed paragraph already covers the internship in
      // general terms and there is no gap for it. Parked somewhere harmless.
      x: 620,
      y: 1075,
      align: "center",
      font: "Montserrat-Bold",
      size: 40,
      color: "#24384a",
      maxWidth: 600,
      minSize: 26,
      enabled: false,
    },
    {
      key: "institution",
      label: "Institution",
      text: "{{institution}}",
      x: 1380,
      y: 1075,
      align: "center",
      font: "Montserrat-Regular",
      size: 34,
      color: "#5b6b7a",
      maxWidth: 600,
      minSize: 24,
      enabled: false,
    },
  ],

  qr: {
    // Clear white space below the body paragraph, left of the MSME mark —
    // verified empty on the artwork across x 240–440, y 1000–1200.
    x: 250,
    y: 1000,
    size: 190,
    margin: 2,
    dark: "#1b2b3a",
    light: "#ffffff",
    enabled: true,
  },
};
