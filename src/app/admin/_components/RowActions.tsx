"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { AdminSubmissionRow } from "@/lib/supabase/types";
import type { GenerateSummary } from "@/lib/certificate/generate";
import type { SendSummary } from "@/lib/email/send";
import { blockingFields, missingFields } from "@/config/editable-fields";

const BTN =
  "rounded-lg border border-line px-2.5 py-1 text-xs font-medium transition hover:bg-brand-soft hover:text-brand disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap";
const BTN_PRIMARY =
  "rounded-lg bg-brand px-2.5 py-1 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap";
const BTN_WARN =
  "rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 whitespace-nowrap";

export function RowActions({ row, onEdit }: { row: AdminSubmissionRow; onEdit: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);
  const [, startTransition] = useTransition();

  const hasCertificate = Boolean(row.certificate_id) && !row.revoked_at;

  // Generate would fail server-side on these anyway. Saying so before the
  // click, and offering the fix, beats a red error afterwards.
  const blocking = blockingFields(row);
  const gaps = missingFields(row);

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

  async function sendEmail() {
    if (!row.certificate_id) return;

    // Re-sending is a real action with a real recipient, so confirm it —
    // especially since regenerating does not recall an already-sent email.
    if (row.last_email_status === "sent") {
      const when = row.last_email_at ? new Date(row.last_email_at).toLocaleString() : "earlier";
      if (!window.confirm(`Already emailed to ${row.last_email_to ?? "them"} on ${when}.\n\nSend again?`)) {
        return;
      }
    }

    setBusy("email");
    setMessage(null);
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ certificateIds: [row.certificate_id] }),
      });
      const data = (await res.json()) as SendSummary & { error?: string };

      if (!res.ok) {
        setMessage({ text: data.error ?? "Send failed.", bad: true });
      } else {
        const result = data.results?.[0];
        if (!result || result.status === "failed") {
          setMessage({ text: result?.message ?? "Send failed.", bad: true });
        } else if (result.status === "skipped") {
          setMessage({ text: result.message ?? "Skipped.", bad: true });
        } else {
          setMessage({ text: `Sent to ${result.to}`, bad: false });
        }
        startTransition(() => router.refresh());
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
        <button
          type="button"
          className={gaps.length > 0 ? BTN_WARN : BTN}
          onClick={onEdit}
          title={
            gaps.length > 0
              ? `Fill in: ${gaps.map((f) => f.label).join(", ")}`
              : "Edit this person's details"
          }
        >
          {gaps.length > 0 ? "Complete details" : "Edit"}
        </button>

        {hasCertificate ? (
          <button type="button" className={BTN} disabled={busy !== null} onClick={() => generate(true)}>
            {busy === "regenerate" ? "…" : "Re-generate"}
          </button>
        ) : (
          <button
            type="button"
            className={BTN_PRIMARY}
            // Nothing to gain from letting this through: generate() rejects a
            // row with no domain or no dates before it renders anything.
            disabled={busy !== null || blocking.length > 0}
            onClick={() => generate(false)}
            title={
              blocking.length > 0
                ? `Cannot issue without: ${blocking.map((f) => f.label).join(", ")}`
                : undefined
            }
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
            <button
              type="button"
              className={row.last_email_status === "sent" ? BTN : BTN_PRIMARY}
              disabled={busy !== null || !row.email}
              onClick={sendEmail}
              title={row.email ? `Send to ${row.email}` : "No email address on file"}
            >
              {busy === "email"
                ? "Sending…"
                : row.last_email_status === "sent"
                  ? "Resend"
                  : "Send email"}
            </button>
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
      ) : row.last_email_status === "failed" && row.last_email_error ? (
        <p className="text-xs text-red-700" title={row.last_email_error}>
          Last send failed: {row.last_email_error.slice(0, 70)}
          {row.last_email_error.length > 70 ? "…" : ""}
        </p>
      ) : null}
    </div>
  );
}
