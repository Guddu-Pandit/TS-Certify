import "server-only";

import { createHash } from "node:crypto";
import { FIELD_MAP, IGNORED_HEADERS, normaliseHeader, type FieldDef } from "@/config/field-map";
import type { SubmissionInsert } from "@/lib/supabase/types";
import type { SheetData } from "./read";

export interface HeaderBinding {
  def: FieldDef;
  /** Index into the header row, or -1 if no column matched. */
  index: number;
  matchedHeader: string | null;
}

export interface MappingPlan {
  bindings: HeaderBinding[];
  /** Headers no field claimed — these flow into `extra`. */
  unmappedHeaders: string[];
  /** Fields with no matching column at all. */
  missingFields: string[];
}

/**
 * Works out, once per sync, which sheet column feeds which database column.
 *
 * Exact normalised match first across every field, then a prefix match as a
 * fallback. Doing exact-first globally matters: if one field's alias is a
 * prefix of another's header, whichever field appeared earlier in FIELD_MAP
 * would otherwise steal the column.
 */
export function planMapping(headers: string[]): MappingPlan {
  const normalised = headers.map(normaliseHeader);
  const claimed = new Set<number>();
  const bindings: HeaderBinding[] = [];

  const findExact = (aliases: string[]) =>
    normalised.findIndex((h, i) => !claimed.has(i) && aliases.includes(h));

  const findPrefix = (aliases: string[]) =>
    normalised.findIndex(
      (h, i) => !claimed.has(i) && aliases.some((a) => h.startsWith(a) || a.startsWith(h)),
    );

  const pending: { def: FieldDef; aliases: string[] }[] = FIELD_MAP.map((def) => ({
    def,
    aliases: def.headers.map(normaliseHeader),
  }));

  const unresolved: typeof pending = [];
  for (const item of pending) {
    const idx = findExact(item.aliases);
    if (idx >= 0) {
      claimed.add(idx);
      bindings.push({ def: item.def, index: idx, matchedHeader: headers[idx] });
    } else {
      unresolved.push(item);
    }
  }

  for (const item of unresolved) {
    const idx = findPrefix(item.aliases);
    if (idx >= 0) {
      claimed.add(idx);
      bindings.push({ def: item.def, index: idx, matchedHeader: headers[idx] });
    } else {
      bindings.push({ def: item.def, index: -1, matchedHeader: null });
    }
  }

  const unmappedHeaders = headers.filter(
    (h, i) => !claimed.has(i) && h !== "" && !IGNORED_HEADERS.includes(normalised[i]),
  );

  const missingFields = bindings.filter((b) => b.index === -1).map((b) => b.def.column);

  return { bindings, unmappedHeaders, missingFields };
}

export interface MappedRow {
  record: SubmissionInsert;
  /** Blocking problems — the row is skipped and reported. */
  errors: string[];
  /** Non-blocking notes, e.g. a date that could not be parsed. */
  warnings: string[];
  sheetRow: number;
}

/**
 * Stable identity for a form response.
 *
 * Google Form rows carry no id, and the row index shifts whenever the sheet is
 * sorted or a row is deleted — so neither can be the key. Email plus the
 * immutable Timestamp can't collide: one person cannot submit twice in the
 * same second.
 */
function sourceKey(args: {
  email: string | null;
  submittedAt: string | null;
  spreadsheetId: string;
  rawValues: string[];
}): string {
  const basis =
    args.email && args.submittedAt
      ? `${args.email.toLowerCase().trim()}|${args.submittedAt}`
      : // No email or no timestamp: fall back to the row's full content. Two
        // genuinely identical rows then collapse into one, which is the
        // desired behaviour for an accidental double submission.
        `${args.spreadsheetId}|${args.rawValues.join("")}`;

  return createHash("sha256").update(basis).digest("hex");
}

export function mapRows(sheet: SheetData, plan: MappingPlan): MappedRow[] {
  return sheet.rows.map((cells, i) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const mapped: Record<string, unknown> = {};

    for (const binding of plan.bindings) {
      if (binding.index === -1) continue;

      const cell = cells[binding.index] ?? "";
      let value: unknown = cell === "" ? null : cell;

      if (value !== null && binding.def.transform) {
        const transformed = binding.def.transform(cell);
        // A transform returning null on non-empty input means it could not
        // read the value — a date in an unexpected format, typically. Surface
        // it rather than silently storing null.
        if (transformed === null) {
          warnings.push(`${binding.matchedHeader}: could not read "${cell}"`);
        }
        value = transformed;
      }

      if (binding.def.required && (value === null || value === "")) {
        errors.push(`${binding.def.column} is required but "${binding.matchedHeader}" is empty`);
      }

      mapped[binding.def.column] = value;
    }

    // Verbatim row, always. This is what makes a mis-mapping debuggable after
    // the fact instead of a data-loss event.
    const raw: Record<string, string> = {};
    sheet.headers.forEach((h, c) => {
      if (h !== "") raw[h] = cells[c] ?? "";
    });

    // Unclaimed columns, so new form questions accumulate from day one.
    const extra: Record<string, string> = {};
    for (const header of plan.unmappedHeaders) {
      const c = sheet.headers.indexOf(header);
      const cell = cells[c] ?? "";
      if (cell !== "") extra[header] = cell;
    }

    const email = (mapped.email as string | null) ?? null;
    const submittedAt = (mapped.submitted_at as string | null) ?? null;

    const record: SubmissionInsert = {
      source_key: sourceKey({
        email,
        submittedAt,
        spreadsheetId: sheet.spreadsheetId,
        rawValues: cells,
      }),
      source_sheet_id: sheet.spreadsheetId,
      source_tab: sheet.tab,
      source_row: sheet.rowNumbers[i],
      submitted_at: submittedAt,
      full_name: (mapped.full_name as string) ?? "",
      email,
      phone: (mapped.phone as string | null) ?? null,
      domain: (mapped.domain as string | null) ?? null,
      institution: (mapped.institution as string | null) ?? null,
      start_date: (mapped.start_date as string | null) ?? null,
      end_date: (mapped.end_date as string | null) ?? null,
      extra,
      raw,
      synced_at: new Date().toISOString(),
    };

    return { record, errors, warnings, sheetRow: sheet.rowNumbers[i] };
  });
}
