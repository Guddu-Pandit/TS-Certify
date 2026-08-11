import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { readSheet } from "./read";
import { mapRows, planMapping } from "./map";

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
 */
export async function syncFromSheet(): Promise<SyncResult> {
  const base: SyncResult = {
    ok: false,
    sheetRows: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
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

  // Which keys already exist, so inserted vs updated can be reported honestly.
  // Upsert alone cannot tell them apart.
  const keys = valid.map((m) => m.record.source_key);
  const existing = new Set<string>();
  for (let i = 0; i < keys.length; i += 500) {
    const { data } = await admin
      .from("submissions")
      .select("source_key")
      .in("source_key", keys.slice(i, i + 500));
    for (const row of data ?? []) existing.add(row.source_key as string);
  }

  // Two sheet rows can normalise to the same key (a genuine double
  // submission). Postgres rejects an upsert whose payload hits the same
  // conflict target twice, so keep the last occurrence of each.
  const deduped = new Map(valid.map((m) => [m.record.source_key, m.record]));
  const records = [...deduped.values()];

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
