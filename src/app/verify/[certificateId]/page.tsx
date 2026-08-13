import type { Metadata } from "next";
import { supabasePublic } from "@/lib/supabase/public";
import { PUBLIC_CERTIFICATE_COLUMNS, type PublicCertificate } from "@/lib/supabase/types";
import { appEnv } from "@/config/env";
import { durationSentence, formatDate } from "@/lib/dates";

// Never cached: a revocation must take effect on the very next scan, not
// whenever a cached copy happens to expire.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verify certificate",
  description: "Check whether a certificate is genuine.",
  robots: { index: false },
};

async function lookup(certificateId: string): Promise<PublicCertificate | null> {
  // Anon key with an explicit column list — deliberately NOT the service-role
  // key. This page is reachable by the whole internet, and a key that bypasses
  // RLS here would turn one careless query into a data breach. Three things
  // must fail together for anything private to leak: the table holds no
  // contact details, anon is granted only these columns, and the query names
  // them. See supabase/002_rls.sql.
  const { data } = await supabasePublic()
    .from("certificates")
    .select(PUBLIC_CERTIFICATE_COLUMNS.join(", "))
    .eq("certificate_id", certificateId)
    .is("revoked_at", null)
    .maybeSingle();

  return (data as PublicCertificate | null) ?? null;
}

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ certificateId: string }>;
}) {
  // params is a Promise in Next 15+.
  const { certificateId } = await params;
  const decoded = decodeURIComponent(certificateId);
  const certificate = await lookup(decoded);
  // Server component, so reading a server-side env var here is fine — only the
  // rendered name reaches the browser, not the variable.
  const org = appEnv().ORG_NAME;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-6 text-center">
          <h1 className="text-lg font-bold tracking-tight text-brand">{org}</h1>
          <p className="mt-1 text-sm text-muted">Certificate verification</p>
        </div>

        {certificate ? (
          <Verified certificate={certificate} />
        ) : (
          <NotVerified certificateId={decoded} />
        )}

        <p className="mt-6 text-center text-xs text-muted">
          This page reads live from {org}&rsquo;s records. A certificate that has been withdrawn
          will stop verifying here even if a printed copy still exists.
        </p>
      </div>
    </main>
  );
}

function Verified({ certificate }: { certificate: PublicCertificate }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
      <div className="flex items-center gap-3 border-b border-emerald-200 bg-emerald-50 px-5 py-4">
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-lg font-bold text-white"
        >
          ✓
        </span>
        <div>
          <p className="font-semibold text-emerald-800">Verified</p>
          <p className="text-sm text-emerald-700">This is a genuine certificate.</p>
        </div>
      </div>

      <dl className="divide-y divide-line">
        <Row label="Name" value={certificate.full_name} strong />
        <Row label="Domain" value={certificate.domain ?? "—"} />
        <Row
          label="Duration"
          value={
            certificate.duration_text ??
            durationSentence(certificate.start_date, certificate.end_date)
          }
        />
        {certificate.start_date && certificate.end_date ? (
          <Row
            label="Period"
            value={`${formatDate(certificate.start_date)} – ${formatDate(certificate.end_date)}`}
          />
        ) : null}
        <Row label="Issued on" value={formatDate(certificate.issued_on)} />
        <Row label="Certificate ID" value={certificate.certificate_id} mono />
      </dl>
    </div>
  );
}

function NotVerified({ certificateId }: { certificateId: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
      <div className="flex items-center gap-3 border-b border-red-200 bg-red-50 px-5 py-4">
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-600 text-lg font-bold text-white"
        >
          !
        </span>
        <div>
          <p className="font-semibold text-red-800">Could not be verified</p>
          <p className="text-sm text-red-700">No active certificate matches this code.</p>
        </div>
      </div>

      <div className="space-y-3 px-5 py-5 text-sm">
        <p>
          Certificate ID checked:{" "}
          <span className="font-mono text-xs break-all">{certificateId}</span>
        </p>
        {/* Deliberately does not distinguish "never existed" from "revoked" —
            that difference is between the issuer and the holder, not something
            to publish to anyone who guesses an id. */}
        <p className="text-muted">
          This code does not correspond to a certificate that is currently valid. It may have been
          mistyped, or the certificate may have been withdrawn.
        </p>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  mono,
}: {
  label: string;
  value: string;
  strong?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 px-5 py-3.5">
      <dt className="w-32 shrink-0 text-sm text-muted">{label}</dt>
      <dd
        className={`min-w-0 flex-1 break-words text-sm ${strong ? "text-base font-semibold" : ""} ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
