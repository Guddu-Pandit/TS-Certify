"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

const FIELD =
  "rounded-lg border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";

/**
 * Filters live in the URL rather than component state, so the actual filtering
 * happens in SQL on the server, the browser back button works, and a filtered
 * view can be bookmarked or pasted to a colleague.
 */
export function Filters({ domains }: { domains: string[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const [q, setQ] = useState(params.get("q") ?? "");

  function apply(changes: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    startTransition(() => router.replace(`/admin?${next.toString()}`));
  }

  // Debounced search: typing should not fire a query per keystroke.
  useEffect(() => {
    const current = params.get("q") ?? "";
    if (q === current) return;
    const timer = setTimeout(() => apply({ q }), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const status = params.get("status") ?? "";
  const domain = params.get("domain") ?? "";
  const hasFilters = Boolean(q || status || domain);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search name, email or certificate ID"
        aria-label="Search submissions"
        className={`${FIELD} w-full sm:w-72`}
      />

      <select
        value={status}
        onChange={(e) => apply({ status: e.target.value })}
        aria-label="Filter by status"
        className={FIELD}
      >
        <option value="">All statuses</option>
        <option value="new">New</option>
        <option value="generated">Generated</option>
        <option value="emailed">Emailed</option>
        <option value="email_failed">Email failed</option>
        <option value="revoked">Revoked</option>
      </select>

      <select
        value={domain}
        onChange={(e) => apply({ domain: e.target.value })}
        aria-label="Filter by domain"
        className={FIELD}
      >
        <option value="">All domains</option>
        {domains.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>

      {hasFilters ? (
        <button
          type="button"
          onClick={() => {
            setQ("");
            startTransition(() => router.replace("/admin"));
          }}
          className="text-sm text-muted underline-offset-2 hover:text-brand hover:underline"
        >
          Clear filters
        </button>
      ) : null}
    </div>
  );
}
