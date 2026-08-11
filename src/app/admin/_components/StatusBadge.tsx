import type { SubmissionStatus } from "@/lib/supabase/types";

/**
 * Status is derived in the SQL view from whether a certificate row and an
 * email_log row exist — never stored — so it cannot drift out of sync with
 * reality.
 */
const STYLES: Record<SubmissionStatus, { label: string; className: string; title: string }> = {
  new: {
    label: "New",
    className: "bg-slate-100 text-slate-700 ring-slate-200",
    title: "Synced from the form. No certificate generated yet.",
  },
  generated: {
    label: "Generated",
    className: "bg-blue-50 text-blue-700 ring-blue-200",
    title: "Certificate created and stored. Not emailed yet.",
  },
  emailed: {
    label: "Emailed",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    title: "Certificate delivered to the student by email.",
  },
  email_failed: {
    label: "Email failed",
    className: "bg-red-50 text-red-700 ring-red-200",
    title: "The last send attempt failed. Open the record for the error.",
  },
  revoked: {
    label: "Revoked",
    className: "bg-amber-50 text-amber-800 ring-amber-200",
    title: "Certificate revoked. Its QR code now reports as unverified.",
  },
};

export function StatusBadge({ status }: { status: SubmissionStatus }) {
  const s = STYLES[status] ?? STYLES.new;
  return (
    <span
      title={s.title}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap ${s.className}`}
    >
      {s.label}
    </span>
  );
}
