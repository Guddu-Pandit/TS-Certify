import type { SubmissionStatus } from "@/lib/supabase/types";

/**
 * Summary row above the submissions table.
 *
 * The dot colours deliberately mirror StatusBadge rather than the brand
 * palette: status is information, not decoration, so "email failed" has to
 * stay red whatever the brand is.
 */
const META: Record<SubmissionStatus, { label: string; dot: string }> = {
  new: { label: "New", dot: "bg-slate-400" },
  generated: { label: "Generated", dot: "bg-blue-500" },
  emailed: { label: "Emailed", dot: "bg-emerald-500" },
  email_failed: { label: "Email failed", dot: "bg-red-500" },
  revoked: { label: "Revoked", dot: "bg-amber-500" },
};

export function StatTiles({
  total,
  counts,
  statuses,
}: {
  total: number;
  counts: Record<string, number>;
  statuses: SubmissionStatus[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <div className="rounded-xl bg-brand px-4 py-3.5 text-white">
        <div className="text-[11px] font-medium tracking-wide text-white/60 uppercase">Total</div>
        <div className="mt-1 text-2xl font-bold tracking-tight text-accent tabular-nums">
          {total}
        </div>
      </div>

      {statuses.map((s) => {
        const meta = META[s];
        return (
          <div key={s} className="rounded-xl border border-line bg-surface px-4 py-3.5">
            <div className="flex items-center gap-1.5">
              <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
              <span className="text-[11px] font-medium tracking-wide text-muted uppercase">
                {meta.label}
              </span>
            </div>
            <div className="mt-1 text-2xl font-bold tracking-tight tabular-nums">
              {counts[s] ?? 0}
            </div>
          </div>
        );
      })}
    </div>
  );
}
