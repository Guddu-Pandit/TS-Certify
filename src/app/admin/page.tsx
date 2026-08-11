import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AdminSubmissionRow } from "@/lib/supabase/types";
import { relativeTime } from "@/lib/dates";
import { SubmissionsTable } from "./_components/SubmissionsTable";
import { SyncButton } from "./_components/SyncButton";

// Always reflect the current database. This page is the operator's view of
// live state; a cached copy showing a stale status would be actively harmful.
export const dynamic = "force-dynamic";

export const metadata = { title: "Submissions · TS-Certify" };

export default async function AdminPage() {
  await requireUser();

  // Read with the service-role key: `submissions` has no RLS policies at all,
  // so this is the only way in, and it only ever happens on the server.
  const { data, error } = await supabaseAdmin()
    .from("admin_submissions_v")
    .select("*")
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .limit(500);

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        <p className="font-medium">Could not load submissions.</p>
        <p className="mt-1">{error.message}</p>
        <p className="mt-2 text-xs">
          If this mentions a missing relation, the SQL in <code>supabase/</code> has not been
          applied. Run <code>npx tsx scripts/check-db.ts</code> to see what is missing.
        </p>
      </div>
    );
  }

  const rows = (data ?? []) as AdminSubmissionRow[];
  const lastSync = rows.reduce<string | null>(
    (latest, r) => (!latest || r.synced_at > latest ? r.synced_at : latest),
    null,
  );

  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Submissions</h1>
          <p className="mt-1 text-sm text-muted">
            {rows.length} record{rows.length === 1 ? "" : "s"} · last synced {relativeTime(lastSync)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          {(["new", "generated", "emailed", "email_failed", "revoked"] as const)
            .filter((s) => counts[s])
            .map((s) => (
              <span key={s} className="rounded-full border border-line bg-surface px-2.5 py-1">
                {counts[s]} {s.replace("_", " ")}
              </span>
            ))}
        </div>
      </div>

      <SyncButton />

      <SubmissionsTable rows={rows} />

      <p className="text-xs text-muted">
        Certificate generation and email sending arrive in the next stages.
      </p>
    </div>
  );
}
