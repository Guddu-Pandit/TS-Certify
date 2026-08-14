import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AdminSubmissionRow, SubmissionStatus } from "@/lib/supabase/types";
import { relativeTime } from "@/lib/dates";
import { SubmissionsTable } from "./_components/SubmissionsTable";
import { SyncButton } from "./_components/SyncButton";
import { Filters } from "./_components/Filters";
import { StatTiles } from "./_components/StatTiles";

// Always reflect the current database. This is the operator's view of live
// state; a cached copy showing a stale status would be actively misleading.
export const dynamic = "force-dynamic";

export const metadata = { title: "Submissions · TS-Certify" };

const STATUSES: SubmissionStatus[] = ["new", "generated", "emailed", "email_failed", "revoked"];

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; domain?: string }>;
}) {
  await requireUser();
  const { q, status, domain } = await searchParams;

  const admin = supabaseAdmin();

  // Read with the service-role key: `submissions` has no RLS policies at all,
  // so this is the only way in, and it only ever happens server-side.
  let query = admin.from("admin_submissions_v").select("*");

  if (domain) query = query.eq("domain", domain);
  if (status && STATUSES.includes(status as SubmissionStatus)) query = query.eq("status", status);
  if (q?.trim()) {
    // Filtering in SQL rather than in the browser, so it still works once
    // there are more rows than a single page can hold.
    const term = `%${q.trim().replace(/[%_]/g, "")}%`;
    query = query.or(
      `full_name.ilike.${term},email.ilike.${term},certificate_id.ilike.${term},institution.ilike.${term}`,
    );
  }

  const { data, error } = await query
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .limit(500);

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        <p className="font-medium">Could not load submissions.</p>
        <p className="mt-1">{error.message}</p>
        <p className="mt-2 text-xs">
          If this mentions a missing relation, the SQL in <code>supabase/</code> has not been
          applied. Run <code>npm run check:db</code> to see what is missing.
        </p>
      </div>
    );
  }

  const rows = (data ?? []) as AdminSubmissionRow[];

  // Counts and the domain list come from the whole table, not the filtered
  // view, so the filter options do not disappear as you narrow the results.
  const { data: allRows } = await admin.from("admin_submissions_v").select("domain, status, synced_at");
  const everything = (allRows ?? []) as Pick<
    AdminSubmissionRow,
    "domain" | "status" | "synced_at"
  >[];

  const domains = [...new Set(everything.map((r) => r.domain).filter((d): d is string => !!d))].sort();

  const counts = everything.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  const lastSync = everything.reduce<string | null>(
    (latest, r) => (!latest || r.synced_at > latest ? r.synced_at : latest),
    null,
  );

  const filtered = Boolean(q || status || domain);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Submissions</h1>
          <p className="mt-1 text-sm text-muted">
            {filtered ? (
              <>
                {rows.length} of {everything.length} records
              </>
            ) : (
              <>
                {everything.length} record{everything.length === 1 ? "" : "s"}
              </>
            )}{" "}
            · last synced {relativeTime(lastSync)}
          </p>
        </div>

        <SyncButton />
      </div>

      <StatTiles total={everything.length} counts={counts} statuses={STATUSES} />

      {/* useSearchParams needs a Suspense boundary during prerender. */}
      <Suspense fallback={<div className="h-9" />}>
        <Filters domains={domains} />
      </Suspense>

      <SubmissionsTable rows={rows} filtered={filtered} />
    </div>
  );
}
