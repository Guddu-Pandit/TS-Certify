"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { SyncResult } from "@/lib/sheets/sync";

export function SyncButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sync() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = (await res.json()) as SyncResult;
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Sync failed.");
      } else {
        setResult(data);
        // Re-run the server component so the table reflects the new rows.
        startTransition(() => router.refresh());
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  const running = busy || isPending;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={sync}
        disabled={running}
        className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {running ? "Syncing…" : "Sync now"}
      </button>

      {error ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
          <p className="font-medium">Sync failed</p>
          <p className="mt-1 whitespace-pre-line">{error}</p>
        </div>
      ) : null}

      {result ? <SyncSummary result={result} /> : null}
    </div>
  );
}

function SyncSummary({ result }: { result: SyncResult }) {
  return (
    <div className="space-y-2 rounded-lg border border-line bg-surface px-3 py-2.5 text-sm">
      <p>
        <span className="font-medium text-emerald-700">{result.inserted} new</span>
        {" · "}
        <span className="text-muted">{result.updated} updated</span>
        {result.skipped > 0 ? (
          <>
            {" · "}
            <span className="text-red-700">{result.skipped} skipped</span>
          </>
        ) : null}
        {" · "}
        <span className="text-muted">{result.sheetRows} rows read</span>
      </p>

      {result.preserved > 0 ? (
        <p className="text-muted">
          {result.preserved} row{result.preserved === 1 ? "" : "s"} kept hand-typed values instead
          of the sheet&apos;s. Open a row and use{" "}
          <span className="font-medium">Release to sheet</span> to undo that.
        </p>
      ) : null}

      {result.missingFields.length > 0 ? (
        <p className="text-amber-800">
          No sheet column matched: <strong>{result.missingFields.join(", ")}</strong>. Add the
          header wording to <code className="font-mono text-xs">src/config/field-map.ts</code>.
        </p>
      ) : null}

      {result.unmappedHeaders.length > 0 ? (
        <p className="text-muted">
          Unmapped columns saved to <code className="font-mono text-xs">extra</code>:{" "}
          {result.unmappedHeaders.join(", ")}
        </p>
      ) : null}

      {result.errors.length > 0 ? (
        <details className="text-red-800">
          <summary className="cursor-pointer font-medium">
            {result.errors.length} row(s) skipped
          </summary>
          <ul className="mt-1 space-y-0.5 pl-4">
            {result.errors.slice(0, 20).map((e) => (
              <li key={e.sheetRow} className="list-disc text-xs">
                Row {e.sheetRow} ({e.name}): {e.messages.join("; ")}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {result.warnings.length > 0 ? (
        <details className="text-amber-800">
          <summary className="cursor-pointer font-medium">
            {result.warnings.length} row(s) with unreadable values
          </summary>
          <ul className="mt-1 space-y-0.5 pl-4">
            {result.warnings.slice(0, 20).map((w) => (
              <li key={w.sheetRow} className="list-disc text-xs">
                Row {w.sheetRow} ({w.name}): {w.messages.join("; ")}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
