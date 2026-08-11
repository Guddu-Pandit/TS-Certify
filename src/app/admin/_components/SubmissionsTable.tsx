"use client";

import Link from "next/link";
import { useState } from "react";
import type { AdminSubmissionRow } from "@/lib/supabase/types";
import { durationLabel, formatDate } from "@/lib/dates";
import { StatusBadge } from "./StatusBadge";
import { RowActions } from "./RowActions";
import { BulkBar } from "./BulkBar";

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
                  </td>
                  <td className={`${TD} text-muted`}>{row.email ?? "—"}</td>
                  <td className={`${TD} whitespace-nowrap text-muted`}>{row.phone ?? "—"}</td>
                  <td className={TD}>{row.domain ?? "—"}</td>
                  <td className={`${TD} text-muted`}>{row.institution ?? "—"}</td>
                  <td className={`${TD} whitespace-nowrap`}>
                    <div>{durationLabel(row.start_date, row.end_date)}</div>
                    <div className="text-xs text-muted">
                      {formatDate(row.start_date)} – {formatDate(row.end_date)}
                    </div>
                  </td>
                  <td className={TD}>
                    <StatusBadge status={row.status} />
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
                    <RowActions row={row} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <BulkBar selected={selected} rows={rows} onClear={() => setSelected([])} />
    </>
  );
}
