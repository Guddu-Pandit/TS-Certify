/**
 * Diagnoses the Google Sheet connection and the column mapping.
 *
 *   npx tsx scripts/check-sheet.ts
 *
 * Prints your real headers, shows which database column each one feeds, lists
 * anything unclaimed, and previews the first few rows as they would be stored.
 * Writes nothing to the database.
 *
 * This is the fastest way to fix a mapping: run it, see which header did not
 * match, add that wording to src/config/field-map.ts, run it again.
 */
import "dotenv/config";
import { readSheet } from "../src/lib/sheets/read";
import { planMapping, mapRows } from "../src/lib/sheets/map";
import { normaliseHeader } from "../src/config/field-map";

async function main() {
  const sheet = await readSheet();

  console.log(`Spreadsheet : ${sheet.spreadsheetId}`);
  console.log(`Tab         : ${sheet.tab}`);
  console.log(`Data rows   : ${sheet.rows.length}\n`);

  if (sheet.headers.length === 0) {
    console.log("No header row found. Is the tab name correct?");
    return;
  }

  const plan = planMapping(sheet.headers);

  console.log("COLUMN MAPPING");
  console.log("-".repeat(78));
  for (const b of plan.bindings) {
    if (b.index >= 0) {
      console.log(`  OK       "${b.matchedHeader}"  ->  ${b.def.column}`);
    } else {
      const req = b.def.required ? "  <-- REQUIRED" : "";
      console.log(`  MISSING  (no column matched)  ->  ${b.def.column}${req}`);
      console.log(`           tried: ${b.def.headers.join(", ")}`);
    }
  }

  if (plan.unmappedHeaders.length > 0) {
    console.log("\nUNMAPPED SHEET COLUMNS  (stored in `extra`, not in their own column)");
    console.log("-".repeat(78));
    for (const h of plan.unmappedHeaders) {
      console.log(`  "${h}"   normalised: "${normaliseHeader(h)}"`);
    }
    console.log("\n  To give one a real column, add it to src/config/field-map.ts");
    console.log("  and add the column in Supabase. See the comment at the top of that file.");
  } else {
    console.log("\nEvery sheet column is mapped.");
  }

  const mapped = mapRows(sheet, plan);
  const bad = mapped.filter((m) => m.errors.length > 0);
  const warned = mapped.filter((m) => m.warnings.length > 0);

  console.log(`\nPREVIEW  (first 3 of ${mapped.length} rows, as they would be stored)`);
  console.log("-".repeat(78));
  for (const m of mapped.slice(0, 3)) {
    const r = m.record;
    console.log(`  sheet row ${m.sheetRow}`);
    console.log(`    name        ${r.full_name || "(blank)"}`);
    console.log(`    email       ${r.email ?? "(blank)"}`);
    console.log(`    phone       ${r.phone ?? "(blank)"}`);
    console.log(`    domain      ${r.domain ?? "(blank)"}`);
    console.log(`    institution ${r.institution ?? "(blank)"}`);
    console.log(`    dates       ${r.start_date ?? "?"} -> ${r.end_date ?? "?"}`);
    console.log(`    submitted   ${r.submitted_at ?? "(blank)"}`);
    const extraKeys = Object.keys(r.extra as Record<string, string>);
    if (extraKeys.length) console.log(`    extra       ${extraKeys.join(", ")}`);
    console.log("");
  }

  if (warned.length) {
    console.log(`WARNINGS  (${warned.length} row(s) — stored, but a value could not be read)`);
    console.log("-".repeat(78));
    for (const m of warned.slice(0, 10)) {
      console.log(`  row ${m.sheetRow} (${m.record.full_name}): ${m.warnings.join("; ")}`);
    }
    console.log("");
  }

  if (bad.length) {
    console.log(`ERRORS  (${bad.length} row(s) would be SKIPPED)`);
    console.log("-".repeat(78));
    for (const m of bad.slice(0, 10)) {
      console.log(`  row ${m.sheetRow}: ${m.errors.join("; ")}`);
    }
    console.log("");
  }

  console.log(
    `Summary: ${mapped.length - bad.length} row(s) would sync, ${bad.length} skipped, ${warned.length} with warnings.`,
  );
}

main().catch((err) => {
  console.error("\n" + (err instanceof Error ? err.message : String(err)));
  process.exit(1);
});
