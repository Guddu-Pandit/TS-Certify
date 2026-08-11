"use client";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-5">
      <h2 className="text-base font-semibold text-red-900">Something went wrong</h2>

      {/* The message is shown because every error thrown in this app is written
          for the operator — missing env vars, an unshared sheet, a bucket
          misconfiguration — and hiding it would just mean a support round-trip. */}
      <p className="mt-2 text-sm whitespace-pre-line text-red-800">{error.message}</p>

      {error.digest ? (
        <p className="mt-2 font-mono text-xs text-red-700">Reference: {error.digest}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-brand px-3.5 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Try again
        </button>
        <a
          href="/admin"
          className="rounded-lg border border-red-300 px-3.5 py-1.5 text-sm font-medium text-red-800 transition hover:bg-red-100"
        >
          Back to submissions
        </a>
      </div>

      <p className="mt-4 text-xs text-red-700">
        If this mentions configuration or a missing table, run{" "}
        <code className="font-mono">npm run check:db</code> in the project folder — it reports
        exactly what is missing.
      </p>
    </div>
  );
}
