import type { SKRSContext2D } from "@napi-rs/canvas";
import type { LayoutField } from "@/config/template";

/**
 * Fits text into a field's maxWidth, and draws it.
 *
 * Long names are the normal case, not an edge case — "Lakshminarayanan
 * Balasubramaniam" at the design size is far wider than the space between the
 * template's borders. The strategy, in order:
 *
 *   1. Shrink the font down towards minSize.
 *   2. If still too wide and the field allows wrapping, split into two
 *      balanced lines and shrink those.
 *   3. If it still does not fit, truncate with an ellipsis — a clipped name is
 *      bad, but a name running off the edge of the artwork is worse.
 *
 * This needs real text metrics, which is why the renderer uses canvas rather
 * than an SVG-based imaging library: you cannot measure a string before
 * drawing it in sharp/librsvg.
 */

function setFont(ctx: SKRSContext2D, field: LayoutField, size: number) {
  ctx.font = `${size}px ${field.font}`;
}

function measure(ctx: SKRSContext2D, field: LayoutField, size: number, s: string): number {
  setFont(ctx, field, size);
  return ctx.measureText(s).width;
}

/** Splits at the space closest to the middle, so the two lines look balanced. */
function splitBalanced(value: string): [string, string] | null {
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length < 2) return null;

  const mid = value.length / 2;
  let best = 1;
  let bestDist = Infinity;

  for (let i = 1; i < words.length; i++) {
    const leftLen = words.slice(0, i).join(" ").length;
    const dist = Math.abs(leftLen - mid);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }

  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
}

function truncate(ctx: SKRSContext2D, field: LayoutField, size: number, s: string, max: number): string {
  if (measure(ctx, field, size, s) <= max) return s;
  let out = s;
  while (out.length > 1 && measure(ctx, field, size, out + "…") > max) {
    out = out.slice(0, -1);
  }
  return out + "…";
}

export interface DrawnText {
  lines: string[];
  size: number;
  /** True when the value had to be shrunk, wrapped, or clipped. */
  adjusted: boolean;
}

export function drawField(
  ctx: SKRSContext2D,
  field: LayoutField,
  rawValue: string,
): DrawnText | null {
  const value = (field.uppercase ? rawValue.toUpperCase() : rawValue).trim();
  if (!value) return null;

  const max = field.maxWidth ?? Infinity;
  const minSize = field.minSize ?? field.size;

  let size = field.size;
  let lines = [value];
  let adjusted = false;

  if (max !== Infinity) {
    // 1. Shrink on one line.
    while (size > minSize && measure(ctx, field, size, value) > max) {
      size -= 2;
      adjusted = true;
    }

    // 2. Still too wide — wrap, then shrink the wider of the two lines.
    if (measure(ctx, field, size, value) > max && field.wrap) {
      const split = splitBalanced(value);
      if (split) {
        lines = split;
        adjusted = true;
        // Wrapping frees vertical room, so start again from the design size.
        size = field.size;
        const widest = () => Math.max(...lines.map((l) => measure(ctx, field, size, l)));
        while (size > minSize && widest() > max) size -= 2;
      }
    }

    // 3. Last resort.
    lines = lines.map((l) => truncate(ctx, field, size, l, max));
  }

  setFont(ctx, field, size);
  ctx.fillStyle = field.color;
  ctx.textAlign = field.align;
  ctx.textBaseline = "alphabetic";

  // Two lines are centred on the original baseline so the block stays visually
  // where a single line would have sat, rather than drifting downwards.
  const lineHeight = size * 1.12;
  const startY = lines.length === 1 ? field.y : field.y - lineHeight / 2;

  lines.forEach((line, i) => {
    ctx.fillText(line, field.x, startY + i * lineHeight);
  });

  return { lines, size, adjusted };
}
