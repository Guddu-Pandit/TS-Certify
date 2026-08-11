"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { AdminSubmissionRow } from "@/lib/supabase/types";
import type { GenerateSummary } from "@/lib/certificate/generate";

const BTN =
  "rounded-lg border border-line px-2.5 py-1 text-xs font-medium transition hover:bg-brand-soft hover:text-brand disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap";
const BTN_PRIMARY =
  "rounded-lg bg-brand px-2.5 py-1 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap";

export function RowActions({ row }: { row: AdminSubmissionRow }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);
  const [, startTransition] = useTransition();

  const hasCertificate = Boolean(row.certificate_id) && !row.revoked_at;

  async function generate(force: boolean) {
    setBusy(force ? "regenerate" : "generate");
    setMessage(null);
    try {
      const res = await fetch("/api/certificates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionIds: [row.id], force }),
      });
      const data = (await res.json()) as GenerateSummary & { error?: string };

      if (!res.ok) {
        setMessage({ text: data.error ?? "Generation failed.", bad: true });
      } else {
        const result = data.results?.[0];
        if (!result || result.status === "failed") {
          setMessage({ text: result?.message ?? "Generation failed.", bad: true });
        } else if (result.status === "skipped") {
          setMessage({ text: result.message ?? "Already generated.", bad: false });
        } else {
          const note = result.adjustedFields?.length
            ? ` (text auto-fitted: ${result.adjustedFields.join(", ")})`
            : "";
          setMessage({
            text: `${result.certificateId}${result.status === "regenerated" ? ` v${result.version}` : ""}${note}`,
            bad: false,
          });
          startTransition(() => router.refresh());
        }
      }
    } catch {
      setMessage({ text: "Could not reach the server.", bad: true });
    } finally {
      setBusy(null);
    }
  }

  async function revoke() {
    if (!row.certificate_id) return;
    const reason = window.prompt(
      `Revoke ${row.certificate_id}?\n\nIts QR code will immediately report as unverified. Optional reason:`,
    );
    // prompt returns null when cancelled; "" means confirmed with no reason.
    if (reason === null) return;

    setBusy("revoke");
    setMessage(null);
    try {
      const res = await fetch(`/api/certificates/${row.certificate_id}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) setMessage({ text: data.error ?? "Revoke failed.", bad: true });
      else startTransition(() => router.refresh());
    } catch {
      setMessage({ text: "Could not reach the server.", bad: true });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        {hasCertificate ? (
          <button type="button" className={BTN} disabled={busy !== null} onClick={() => generate(true)}>
            {busy === "regenerate" ? "…" : "Re-generate"}
          </button>
        ) : (
          <button
            type="button"
            className={BTN_PRIMARY}
            disabled={busy !== null}
            onClick={() => generate(false)}
          >
            {busy === "generate" ? "Generating…" : "Generate"}
          </button>
        )}

        <a
          className={BTN}
          href={`/api/certificates/${row.id}/preview`}
          target="_blank"
          rel="noreferrer"
          title="Render live without saving anything"
        >
          Preview
        </a>

        {hasCertificate ? (
          <>
            <a
              className={BTN}
              href={`/api/certificates/${row.certificate_id}/download`}
              target="_blank"
              rel="noreferrer"
            >
              PDF
            </a>
            <button type="button" className={BTN} disabled={busy !== null} onClick={revoke}>
              {busy === "revoke" ? "…" : "Revoke"}
            </button>
          </>
        ) : null}
      </div>

      {message ? (
        <p className={`text-xs ${message.bad ? "text-red-700" : "text-emerald-700"}`}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
