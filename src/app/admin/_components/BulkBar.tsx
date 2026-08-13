"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { AdminSubmissionRow } from "@/lib/supabase/types";
import type { GenerateSummary } from "@/lib/certificate/generate";
import type { SendSummary } from "@/lib/email/send";

/**
 * Batch limits.
 *
 * Renders are sequential and memory-heavy (a ~35MB bitmap each), and the
 * serverless function has a 60s ceiling — so the client chunks the work and
 * loops rather than sending one huge request that would time out halfway and
 * leave the operator unsure what happened.
 */
const GENERATE_CHUNK = 10;
const EMAIL_CHUNK = 20;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function BulkBar({
  selected,
  rows,
  onClear,
}: {
  selected: string[];
  rows: AdminSubmissionRow[];
  onClear: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"generate" | "email" | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [report, setReport] = useState<string[] | null>(null);
  const [, startTransition] = useTransition();

  if (selected.length === 0) return null;

  const chosen = rows.filter((r) => selected.includes(r.id));
  const needCertificate = chosen.filter((r) => !r.certificate_id || r.revoked_at);
  const emailable = chosen.filter((r) => r.certificate_id && !r.revoked_at && r.email);
  const noEmail = chosen.filter((r) => r.certificate_id && !r.revoked_at && !r.email);

  async function bulkGenerate() {
    const ids = needCertificate.map((r) => r.id);
    if (ids.length === 0) return;

    setBusy("generate");
    setReport(null);
    const batches = chunk(ids, GENERATE_CHUNK);
    setProgress({ done: 0, total: ids.length });

    let created = 0;
    let skipped = 0;
    const failures: string[] = [];

    for (const [i, batch] of batches.entries()) {
      try {
        const res = await fetch("/api/certificates/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ submissionIds: batch }),
        });
        const data = (await res.json()) as GenerateSummary & { error?: string };
        if (!res.ok) {
          failures.push(data.error ?? "Request failed.");
        } else {
          created += data.created + data.regenerated;
          skipped += data.skipped;
          for (const r of data.results) {
            if (r.status === "failed") failures.push(`${r.name || "row"}: ${r.message}`);
          }
        }
      } catch {
        failures.push("Could not reach the server.");
      }
      setProgress({ done: Math.min((i + 1) * GENERATE_CHUNK, ids.length), total: ids.length });
    }

    setProgress(null);
    setBusy(null);
    setReport([
      `${created} generated`,
      ...(skipped ? [`${skipped} already had one`] : []),
      ...failures.slice(0, 8),
    ]);
    startTransition(() => router.refresh());
  }

  async function bulkEmail() {
    const ids = emailable.map((r) => r.certificate_id!).filter(Boolean);
    if (ids.length === 0) return;

    const alreadySent = emailable.filter((r) => r.last_email_status === "sent").length;
    const warning = alreadySent
      ? `\n\n${alreadySent} of these were already emailed. They will receive it again.`
      : "";
    if (!window.confirm(`Send ${ids.length} certificate email${ids.length === 1 ? "" : "s"}?${warning}`)) {
      return;
    }

    setBusy("email");
    setReport(null);
    const batches = chunk(ids, EMAIL_CHUNK);
    setProgress({ done: 0, total: ids.length });

    let sent = 0;
    let skippedCount = 0;
    const failures: string[] = [];

    for (const [i, batch] of batches.entries()) {
      try {
        const res = await fetch("/api/email/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ certificateIds: batch }),
        });
        const data = (await res.json()) as SendSummary & { error?: string };
        if (!res.ok) {
          failures.push(data.error ?? "Request failed.");
        } else {
          sent += data.sent;
          skippedCount += data.skipped;
          for (const r of data.results) {
            if (r.status === "failed") failures.push(`${r.name || r.certificateId}: ${r.message}`);
          }
        }
      } catch {
        failures.push("Could not reach the server.");
      }
      setProgress({ done: Math.min((i + 1) * EMAIL_CHUNK, ids.length), total: ids.length });
    }

    setProgress(null);
    setBusy(null);
    setReport([
      `${sent} sent`,
      ...(skippedCount ? [`${skippedCount} skipped`] : []),
      ...failures.slice(0, 8),
    ]);
    startTransition(() => router.refresh());
  }

  return (
    <div className="sticky bottom-0 z-10 -mx-4 border-t border-line bg-surface/95 px-4 py-3 shadow-[0_-2px_12px_rgba(0,0,0,0.06)] backdrop-blur sm:-mx-6 sm:px-6">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3">
        <span className="text-sm font-medium">
          {selected.length} selected
          {progress ? (
            <span className="ml-2 font-normal text-muted">
              — {progress.done} of {progress.total}…
            </span>
          ) : null}
        </span>

        <button
          type="button"
          onClick={bulkGenerate}
          disabled={busy !== null || needCertificate.length === 0}
          className="rounded-lg bg-brand px-3.5 py-1.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === "generate" ? "Generating…" : `Generate ${needCertificate.length}`}
        </button>

        <button
          type="button"
          onClick={bulkEmail}
          disabled={busy !== null || emailable.length === 0}
          className="rounded-lg border border-line px-3.5 py-1.5 text-sm font-medium transition hover:bg-brand-soft hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === "email" ? "Sending…" : `Email ${emailable.length}`}
        </button>

        {noEmail.length > 0 ? (
          <span className="text-xs text-amber-700">
            {noEmail.length} of these have no email address
          </span>
        ) : null}

        <button
          type="button"
          onClick={onClear}
          disabled={busy !== null}
          className="ml-auto text-sm text-muted underline-offset-2 hover:underline disabled:opacity-50"
        >
          Clear
        </button>
      </div>

      {report ? (
        <div className="mx-auto mt-2 max-w-[1400px] space-y-0.5 text-xs">
          {report.map((line, i) => (
            <p key={i} className={i === 0 ? "font-medium text-emerald-700" : "text-muted"}>
              {line}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
