import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { EDITABLE_COLUMNS } from "@/config/editable-fields";
import { readSheet } from "./read";
import { mapRows, planMapping } from "./map";

/** Only these columns may be reinstated from `manual_overrides`. */
const OVERRIDABLE = new Set<string>(EDITABLE_COLUMNS);

export interface SyncRowIssue {
  sheetRow: number;
  name: string;
  messages: string[];
}

export interface SyncResult {
  ok: boolean;
  sheetRows: number;
  inserted: number;
  updated: number;
  skipped: number;
  /** Rows where a hand-typed value was kept instead of the sheet's cell. */
  preserved: number;
  /** Sheet columns no field claims — how you learn a question was added. */
  unmappedHeaders: string[];
  /** Fields with no matching column in the sheet. */
  missingFields: string[];
  errors: SyncRowIssue[];
  warnings: SyncRowIssue[];
  error?: string;
}

/**
 * Pulls the Google Sheet into `submissions`.
 *
 * Idempotent: upserting on `source_key` means running this twice in a row
 * changes nothing, and a correction made in the sheet propagates on the next
 * run. Already-issued certificates are NOT affected — those hold their own
 * snapshot, because a document already in a student's hands must not silently
 * change.
 *
 * Values a human filled in from /admin also survive: `manual_overrides` is
 * layered over the mapped record before the upsert, so re-syncing cannot
 * replace a hand-typed end date with the blank cell it came from.
 */
export async function syncFromSheet(): Promise<SyncResult> {
  const base: SyncResult = {
    ok: false,
    sheetRows: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    preserved: 0,
    unmappedHeaders: [],
    missingFields: [],
    errors: [],
    warnings: [],
  };

  const sheet = await readSheet();
  base.sheetRows = sheet.rows.length;

  if (sheet.headers.length === 0) {
    return { ...base, ok: true, error: "The sheet is empty — no header row found." };
  }

  const plan = planMapping(sheet.headers);
  base.unmappedHeaders = plan.unmappedHeaders;
  base.missingFields = plan.missingFields;

  const mapped = mapRows(sheet, plan);

  const valid = mapped.filter((m) => m.errors.length === 0);
  const invalid = mapped.filter((m) => m.errors.length > 0);

  base.errors = invalid.map((m) => ({
    sheetRow: m.sheetRow,
    name: m.record.full_name || "(no name)",
    messages: m.errors,
  }));
  base.warnings = valid
    .filter((m) => m.warnings.length > 0)
    .map((m) => ({ sheetRow: m.sheetRow, name: m.record.full_name, messages: m.warnings }));
  base.skipped = invalid.length;

  if (valid.length === 0) {
    return { ...base, ok: true };
  }

  const admin = supabaseAdmin();

  // Which keys already exist, so inserted vs updated can be reported honestly
  // (upsert alone cannot tell them apart), and which of them carry hand-typed
  // values that must outlive this run.
  const keys = valid.map((m) => m.record.source_key);
  const existing = new Set<string>();
  const overrides = new Map<string, Record<string, unknown>>();
  for (let i = 0; i < keys.length; i += 500) {
    const { data } = await admin
      .from("submissions")
      .select("source_key, manual_overrides")
      .in("source_key", keys.slice(i, i + 500));
    for (const row of data ?? []) {
      const key = row.source_key as string;
      existing.add(key);
      const saved = (row.manual_overrides ?? {}) as Record<string, unknown>;
      // Filtered against the allow-list here as well as on write: this value
      // ends up in an upsert payload, so an unexpected key would become an
      // unexpected column.
      const usable = Object.fromEntries(
        Object.entries(saved).filter(([column]) => OVERRIDABLE.has(column)),
      );
      if (Object.keys(usable).length > 0) overrides.set(key, usable);
    }
  }

  // Two sheet rows can normalise to the same key (a genuine double
  // submission). Postgres rejects an upsert whose payload hits the same
  // conflict target twice, so keep the last occurrence of each.
  const deduped = new Map(valid.map((m) => [m.record.source_key, m.record]));

  const records = [...deduped.values()].map((record) => {
    const manual = overrides.get(record.source_key);
    if (!manual) return record;
    base.preserved += 1;
    // Manual value wins. The sheet is the source of truth right up until a
    // human decides otherwise, and they only do that because it was wrong.
    return { ...record, ...manual } as typeof record;
  });

  for (let i = 0; i < records.length; i += 200) {
    const chunk = records.slice(i, i + 200);
    const { error } = await admin.from("submissions").upsert(chunk, { onConflict: "source_key" });
    if (error) {
      return { ...base, ok: false, error: `Database write failed: ${error.message}` };
    }
  }

  base.inserted = records.filter((r) => !existing.has(r.source_key)).length;
  base.updated = records.length - base.inserted;

  return { ...base, ok: true };
}
