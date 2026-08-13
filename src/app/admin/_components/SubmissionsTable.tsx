"use client";

import Link from "next/link";
import { useState } from "react";
import type { AdminSubmissionRow } from "@/lib/supabase/types";
import { durationLabel, formatDate } from "@/lib/dates";
import { missingFields } from "@/config/editable-fields";
import { StatusBadge } from "./StatusBadge";
import { RowActions } from "./RowActions";
import { BulkBar } from "./BulkBar";
import { EditSubmissionDialog } from "./EditSubmissionDialog";

const TH =
  "px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted whitespace-nowrap";
const TD = "px-3 py-3 text-sm align-top";

export function SubmissionsTable({
  rows,
  filtered,
}: {
  rows: AdminSubmissionRow[];
  /** True when filters are active, so the empty state can say so. */
  filtered?: boolean;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  // One dialog for the whole table rather than one per row — 500 mounted
  // modals would be 500 forms in the DOM for a thing you open once.
  const [editing, setEditing] = useState<AdminSubmissionRow | null>(null);

  const allSelected = rows.length > 0 && selected.length === rows.length;

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleAll() {
    setSelected(allSelected ? [] : rows.map((r) => r.id));
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-surface px-6 py-16 text-center">
        <p className="text-sm font-medium">
          {filtered ? "No records match these filters" : "No submissions yet"}
        </p>
        <p className="mt-1 text-sm text-muted">
          {filtered ? (
            "Try clearing the search or filters above."
          ) : (
            <>
              Use <span className="font-medium">Sync now</span> to pull responses from the Google
              Form.
            </>
          )}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="table-scroll rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[1250px] border-collapse">
          <thead className="border-b border-line bg-brand-soft/40">
            <tr>
              <th className={`${TH} w-10`}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all rows"
                  className="h-4 w-4 cursor-pointer"
                />
              </th>
              <th className={TH}>Name</th>
              <th className={TH}>Email</th>
              <th className={TH}>Phone</th>
              <th className={TH}>Domain</th>
              <th className={TH}>School / College</th>
              <th className={TH}>Duration</th>
              <th className={TH}>Status</th>
              <th className={TH}>Certificate / QR</th>
              <th className={TH}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isSelected = selected.includes(row.id);
              const gaps = missingFields(row);
              const edit = () => setEditing(row);
              return (
                <tr
                  key={row.id}
                  className={`border-b border-line last:border-0 ${
                    isSelected ? "bg-brand-soft/50" : "hover:bg-brand-soft/25"
                  }`}
                >
                  <td className={TD}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(row.id)}
                      aria-label={`Select ${row.full_name}`}
                      className="h-4 w-4 cursor-pointer"
                    />
                  </td>
                  <td className={`${TD} font-medium`}>
                    <Link
                      href={`/admin/submissions/${row.id}`}
                      className="hover:text-brand hover:underline"
                    >
                      {row.full_name}
                    </Link>
                    {row.edited_at ? (
                      <span
                        className="ml-1.5 text-xs font-normal text-muted"
                        title="Some fields on this row were filled in by hand"
                      >
                        ✎
                      </span>
                    ) : null}
                  </td>
                  <td className={`${TD} text-muted`}>
                    <Cell value={row.email} label="email" onEdit={edit} />
                  </td>
                  <td className={`${TD} whitespace-nowrap text-muted`}>
                    <Cell value={row.phone} label="phone" onEdit={edit} />
                  </td>
                  <td className={TD}>
                    <Cell value={row.domain} label="domain" onEdit={edit} />
                  </td>
                  <td className={`${TD} text-muted`}>
                    <Cell value={row.institution} label="college" onEdit={edit} />
                  </td>
                  <td className={`${TD} whitespace-nowrap`}>
                    {row.start_date && row.end_date ? (
                      <>
                        <div>{durationLabel(row.start_date, row.end_date)}</div>
                        <div className="text-xs text-muted">
                          {formatDate(row.start_date)} – {formatDate(row.end_date)}
                        </div>
                      </>
                    ) : (
                      <Cell
                        value={null}
                        label={!row.start_date && !row.end_date ? "dates" : !row.start_date ? "start date" : "end date"}
                        onEdit={edit}
                      />
                    )}
                  </td>
                  <td className={TD}>
                    <StatusBadge status={row.status} />
                    {gaps.length > 0 ? (
                      <button
                        type="button"
                        onClick={edit}
                        className="mt-1 block text-left text-xs text-amber-800 underline-offset-2 hover:underline"
                        title={`Missing: ${gaps.map((f) => f.label).join(", ")}`}
                      >
                        {gaps.length} field{gaps.length === 1 ? "" : "s"} missing
                      </button>
                    ) : null}
                  </td>
                  <td className={TD}>
                    {row.certificate_id ? (
                      // The same URL the QR encodes, so you can check what a
                      // student sees without scanning anything.
                      <Link
                        href={`/verify/${row.certificate_id}`}
                        target="_blank"
                        className="font-mono text-xs text-brand hover:underline"
                      >
                        {row.certificate_id}
                      </Link>
                    ) : (
                      <span className="text-xs text-muted">Not generated</span>
                    )}
                    {row.revoked_at ? (
                      <div className="mt-0.5 text-xs text-amber-700">revoked</div>
                    ) : row.cert_version && row.cert_version > 1 ? (
                      <div className="mt-0.5 text-xs text-muted">v{row.cert_version}</div>
                    ) : null}
                  </td>
                  <td className={TD}>
                    <RowActions row={row} onEdit={edit} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <BulkBar selected={selected} rows={rows} onClear={() => setSelected([])} />

      {editing ? (
        <EditSubmissionDialog submission={editing} onClose={() => setEditing(null)} />
      ) : null}
    </>
  );
}

/**
 * A value, or the button that fills it in. An em dash tells you something is
 * absent; this tells you what to do about it, which is the whole point of
 * noticing at all.
 */
function Cell({
  value,
  label,
  onEdit,
}: {
  value: string | null;
  label: string;
  onEdit: () => void;
}) {
  if (value) return <>{value}</>;
  return (
    <button
      type="button"
      onClick={onEdit}
      className="rounded border border-dashed border-amber-300 px-1.5 py-0.5 text-xs text-amber-800 transition hover:border-amber-500 hover:bg-amber-50"
    >
      + {label}
    </button>
  );
}
