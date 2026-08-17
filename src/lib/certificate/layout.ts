import "server-only";

import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  ALIGNS,
  DEFAULT_LAYOUT,
  FONT_NAMES,
  type Layout,
  type LayoutField,
} from "@/config/template";

/**
 * Loading and saving the editable field positions.
 *
 * The layout is user data now, and user data arrives broken: a field dragged
 * off the page, a font that no longer exists, a row hand-edited in the
 * Supabase table editor. Every read AND every write goes through the schema
 * below, and a read that fails falls back to DEFAULT_LAYOUT — a certificate
 * rendered from last-known-good defaults is recoverable, one rendered from
 * garbage coordinates is not.
 */

/** The row the app reads. One key, so there is no "which layout?" ambiguity. */
export const ACTIVE_LAYOUT_KEY = "active";

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "must be a 6-digit hex colour like #24384a");

const fieldSchema = z.object({
  // Keys end up in adjustedFields warnings and in the editor's marker labels;
  // keeping them plain avoids surprises in both.
  key: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[A-Za-z][A-Za-z0-9_-]*$/, "letters, digits, dash and underscore only"),
  label: z.string().trim().min(1).max(60),
  text: z.string().max(400),
  x: z.number().int().min(-2000).max(20000),
  y: z.number().int().min(-2000).max(20000),
  align: z.enum(ALIGNS as [string, ...string[]]).transform((v) => v as LayoutField["align"]),
  font: z.enum(FONT_NAMES as [string, ...string[]]).transform((v) => v as LayoutField["font"]),
  size: z.number().int().min(6).max(600),
  color: hexColor,
  maxWidth: z.number().int().min(20).max(20000).optional(),
  minSize: z.number().int().min(6).max(600).optional(),
  wrap: z.boolean().optional(),
  uppercase: z.boolean().optional(),
  enabled: z.boolean(),
});

const qrSchema = z.object({
  x: z.number().int().min(-2000).max(20000),
  y: z.number().int().min(-2000).max(20000),
  size: z.number().int().min(40).max(2000),
  margin: z.number().int().min(0).max(10),
  dark: hexColor,
  light: hexColor,
  enabled: z.boolean(),
});

export const layoutSchema = z
  .object({
    fields: z.array(fieldSchema).max(40),
    qr: qrSchema,
  })
  .superRefine((layout, ctx) => {
    const seen = new Set<string>();
    for (const field of layout.fields) {
      if (seen.has(field.key)) {
        ctx.addIssue({
          code: "custom",
          path: ["fields"],
          message: `Duplicate field key "${field.key}". Keys must be unique.`,
        });
      }
      seen.add(field.key);
    }
  });

export interface LoadedLayout extends Layout {
  /** "database" once someone has saved; "defaults" until then. */
  source: "database" | "defaults";
  updatedAt: string | null;
  /** Set when a stored row existed but could not be used. */
  problem: string | null;
}

function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  return issue ? `${issue.path.join(".") || "layout"}: ${issue.message}` : "invalid layout";
}

export async function loadLayout(): Promise<LoadedLayout> {
  const fallback = (problem: string | null): LoadedLayout => ({
    ...structuredClone(DEFAULT_LAYOUT),
    source: "defaults",
    updatedAt: null,
    problem,
  });

  // Wrapped because this must never be the reason a certificate fails to
  // render: `npm run render:sample` runs with no database at all, and a
  // missing table just means 005_certificate_layout.sql has not been applied
  // yet. Either way the defaults are a perfectly good certificate.
  let data: { fields: unknown; qr: unknown; updated_at: string } | null = null;

  try {
    const result = await supabaseAdmin()
      .from("certificate_layouts")
      .select("fields, qr, updated_at")
      .eq("key", ACTIVE_LAYOUT_KEY)
      .maybeSingle<{ fields: unknown; qr: unknown; updated_at: string }>();

    if (result.error) return fallback(`Could not read the saved layout: ${result.error.message}`);
    data = result.data;
  } catch (err) {
    return fallback(
      `Could not reach the database: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!data) return fallback(null);

  const parsed = layoutSchema.safeParse({ fields: data.fields, qr: data.qr });
  if (!parsed.success) {
    return fallback(`The saved layout is invalid (${firstIssue(parsed.error)}). Using defaults.`);
  }

  return {
    fields: parsed.data.fields,
    qr: parsed.data.qr,
    source: "database",
    updatedAt: data.updated_at,
    problem: null,
  };
}

export type SaveResult = { ok: true } | { ok: false; error: string };

export async function saveLayout(input: unknown, userId: string | null): Promise<SaveResult> {
  const parsed = layoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const { error } = await supabaseAdmin().from("certificate_layouts").upsert(
    {
      key: ACTIVE_LAYOUT_KEY,
      fields: parsed.data.fields,
      qr: parsed.data.qr,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    },
    { onConflict: "key" },
  );

  if (error) {
    return {
      ok: false,
      error:
        error.code === "42P01"
          ? "Table certificate_layouts is missing — apply supabase/005_certificate_layout.sql first."
          : error.message,
    };
  }

  return { ok: true };
}

/** Drops the saved row so the code defaults take over again. */
export async function resetLayout(): Promise<SaveResult> {
  const { error } = await supabaseAdmin()
    .from("certificate_layouts")
    .delete()
    .eq("key", ACTIVE_LAYOUT_KEY);

  return error ? { ok: false, error: error.message } : { ok: true };
}
