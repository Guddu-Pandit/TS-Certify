import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { CertificateRow, EmailLogRow, SubmissionRow } from "@/lib/supabase/types";
import { durationSentence, formatDate, formatDateTime } from "@/lib/dates";
import { StatusBadge } from "../../_components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const admin = supabaseAdmin();

  const { data: submission } = await admin
    .from("submissions")
    .select("*")
    .eq("id", id)
    .maybeSingle<SubmissionRow>();

  if (!submission) notFound();

  const { data: certificates } = await admin
    .from("certificates")
    .select("*")
    .eq("submission_id", id)
    .order("created_at", { ascending: false });

  const certs = (certificates ?? []) as CertificateRow[];
  const active = certs.find((c) => !c.revoked_at);

  const { data: emails } = certs.length
    ? await admin
        .from("email_log")
        .select("*")
        .in(
          "certificate_id",
          certs.map((c) => c.id),
        )
        .order("sent_at", { ascending: false })
    : { data: [] };

  const log = (emails ?? []) as EmailLogRow[];

  const extra = submission.extra as Record<string, string>;
  const raw = submission.raw as Record<string, string>;

  const status = !certs.length
    ? "new"
    : !active
      ? "revoked"
      : log[0]?.status === "sent"
        ? "emailed"
        : log[0]?.status === "failed"
          ? "email_failed"
          : "generated";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="text-sm text-muted underline-offset-2 hover:text-brand hover:underline">
          ← Back to submissions
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight">{submission.full_name}</h1>
          <StatusBadge status={status} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Details">
          <Field label="Email" value={submission.email} />
          <Field label="Phone" value={submission.phone} />
          <Field label="Domain" value={submission.domain} />
          <Field label="School / College" value={submission.institution} />
          <Field label="Duration" value={durationSentence(submission.start_date, submission.end_date)} />
          <Field label="Submitted" value={formatDateTime(submission.submitted_at)} />
          <Field label="Last synced" value={formatDateTime(submission.synced_at)} />
          <Field label="Sheet row" value={submission.source_row ? `#${submission.source_row}` : null} />
        </Card>

        <Card title="Certificates">
          {certs.length === 0 ? (
            <p className="px-4 py-4 text-sm text-muted">
              None yet. Generate one from the submissions table.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {certs.map((c) => (
                <li key={c.id} className="space-y-1 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/verify/${c.certificate_id}`}
                      target="_blank"
                      className="font-mono text-sm text-brand hover:underline"
                    >
                      {c.certificate_id}
                    </Link>
                    <span className="text-xs text-muted">v{c.version}</span>
                    {c.revoked_at ? (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800 ring-1 ring-inset ring-amber-200">
                        revoked {formatDate(c.revoked_at)}
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 ring-1 ring-inset ring-emerald-200">
                        active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted">
                    Issued {formatDate(c.issued_on)} · {c.domain} · {c.duration_text}
                  </p>
                  {c.revoke_reason ? (
                    <p className="text-xs text-amber-800">Reason: {c.revoke_reason}</p>
                  ) : null}
                  <p className="font-mono text-xs break-all text-muted">{c.pdf_path}</p>
                  {!c.revoked_at ? (
                    <a
                      href={`/api/certificates/${c.certificate_id}/download`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block text-xs text-brand underline-offset-2 hover:underline"
                    >
                      Download PDF
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Email history">
          {log.length === 0 ? (
            <p className="px-4 py-4 text-sm text-muted">No emails sent yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {log.map((e) => (
                <li key={e.id} className="space-y-0.5 px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                        e.status === "sent"
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                          : "bg-red-50 text-red-700 ring-red-200"
                      }`}
                    >
                      {e.status}
                    </span>
                    <span className="text-muted">{formatDateTime(e.sent_at)}</span>
                  </div>
                  <p className="text-muted">to {e.to_email}</p>
                  {e.subject ? <p className="text-xs">{e.subject}</p> : null}
                  {e.error ? <p className="text-xs text-red-700">{e.error}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Form data">
          {Object.keys(extra).length > 0 ? (
            <div className="border-b border-line px-4 py-3">
              <p className="mb-2 text-xs font-semibold">
                Unmapped columns{" "}
                <span className="font-normal text-muted">
                  — captured automatically, no column of their own yet
                </span>
              </p>
              <dl className="space-y-1">
                {Object.entries(extra).map(([k, v]) => (
                  <div key={k} className="flex flex-wrap gap-x-3 text-sm">
                    <dt className="text-muted">{k}</dt>
                    <dd className="font-medium">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          {/* The verbatim sheet row. This is what makes a mis-mapped column
              diagnosable after the fact instead of a data-loss event. */}
          <details className="px-4 py-3">
            <summary className="cursor-pointer text-xs font-semibold">
              Raw sheet row ({Object.keys(raw).length} columns)
            </summary>
            <dl className="mt-2 space-y-1">
              {Object.entries(raw).map(([k, v]) => (
                <div key={k} className="flex flex-wrap gap-x-3 text-xs">
                  <dt className="min-w-40 text-muted">{k}</dt>
                  <dd className="break-all">{String(v) || "—"}</dd>
                </div>
              ))}
            </dl>
          </details>
        </Card>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-line bg-surface">
      <h2 className="border-b border-line px-4 py-2.5 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-wrap gap-x-4 border-b border-line px-4 py-2.5 last:border-0">
      <span className="w-36 shrink-0 text-sm text-muted">{label}</span>
      <span className="min-w-0 flex-1 break-words text-sm">{value || "—"}</span>
    </div>
  );
}
