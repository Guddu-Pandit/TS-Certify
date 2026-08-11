/**
 * Verifies that the Supabase project matches what the app expects.
 *
 *   npx tsx scripts/check-db.ts
 *
 * Checks every table, the admin view, the certificate-id function, the storage
 * bucket and its privacy, and that RLS actually denies anonymous reads.
 * Run it after applying the SQL files, and any time something behaves oddly.
 */
// Next.js loads .env on its own; plain `tsx` does not, so pull it in here.
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !serviceKey || !anonKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false } });

const results: { ok: boolean; label: string; detail?: string }[] = [];
const pass = (label: string, detail?: string) => results.push({ ok: true, label, detail });
const fail = (label: string, detail?: string) => results.push({ ok: false, label, detail });

async function checkTable(name: string) {
  const { error, count } = await admin.from(name).select("*", { count: "exact", head: true });
  if (error) fail(`table ${name}`, error.message);
  else pass(`table ${name}`, `${count ?? 0} rows`);
}

async function main() {
  console.log(`Checking ${url}\n`);

  for (const t of ["profiles", "submissions", "certificates", "certificate_counters", "email_log", "email_templates"]) {
    await checkTable(t);
  }
  await checkTable("admin_submissions_v");

  // The email template the send flow reads. Missing it means 003_seed.sql did not run.
  const { data: tpl } = await admin
    .from("email_templates")
    .select("key, subject")
    .eq("key", "certificate_delivery")
    .maybeSingle();
  if (tpl) pass("email template seeded", tpl.subject as string);
  else fail("email template seeded", "run supabase/003_seed.sql");

  // Certificate id allocator.
  //
  // The counter is per-YEAR, not per-prefix, so simply calling this would burn
  // a real sequence number and make the first issued certificate #0002.
  // Snapshot the counter, call it, then restore.
  const year = new Date().getFullYear();
  const { data: before } = await admin
    .from("certificate_counters")
    .select("last_seq")
    .eq("year", year)
    .maybeSingle<{ last_seq: number }>();

  const { data: gen, error: genErr } = await admin.rpc("next_certificate_id", { p_prefix: "SELFTEST" });
  if (genErr) {
    fail("next_certificate_id()", genErr.message);
  } else {
    if (before) {
      await admin.from("certificate_counters").update({ last_seq: before.last_seq }).eq("year", year);
    } else {
      // The call created the year row; remove it so the sequence starts at 1.
      await admin.from("certificate_counters").delete().eq("year", year);
    }
    pass("next_certificate_id()", `returned ${gen}, counter restored`);
  }

  // Storage bucket, and whether it is private as intended.
  const { data: buckets, error: bucketErr } = await admin.storage.listBuckets();
  if (bucketErr) {
    fail("storage buckets", bucketErr.message);
  } else {
    const bucket = buckets.find((b) => b.name === "certificates");
    if (!bucket) fail("bucket 'certificates'", `not found (have: ${buckets.map((b) => b.name).join(", ") || "none"})`);
    else if (bucket.public) fail("bucket 'certificates'", "exists but is PUBLIC — it must be private");
    else pass("bucket 'certificates'", "exists and is private");
  }

  // RLS: anon must see nothing in submissions, and must see certificates.
  const { data: anonSubs, error: anonSubErr } = await anon.from("submissions").select("id").limit(1);
  if (anonSubErr || (anonSubs && anonSubs.length === 0)) {
    pass("RLS: anon cannot read submissions", anonSubErr ? anonSubErr.message : "returned 0 rows");
  } else {
    fail("RLS: anon cannot read submissions", `LEAK — anon read ${anonSubs?.length} row(s)`);
  }

  const { error: anonCertErr } = await anon
    .from("certificates")
    .select("certificate_id, full_name, domain, issued_on")
    .limit(1);
  if (anonCertErr) fail("RLS: anon can read certificates", anonCertErr.message);
  else pass("RLS: anon can read certificates", "verify page will work");

  // Column grants: selecting a column anon was not granted must fail.
  const { error: overReach } = await anon.from("certificates").select("submission_id").limit(1);
  if (overReach) pass("column grants enforced", "anon blocked from submission_id");
  else fail("column grants enforced", "anon could read submission_id — re-run 002_rls.sql");

  console.log(results.map((r) => `${r.ok ? "PASS" : "FAIL"}  ${r.label}${r.detail ? `  — ${r.detail}` : ""}`).join("\n"));

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error("\nCheck failed:", err.message ?? err);
  process.exit(1);
});
