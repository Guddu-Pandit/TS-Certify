import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { CertificateRow } from "@/lib/supabase/types";
import { formatDate } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const metadata = { title: "Certificates · TS-Certify" };

const TH =
  "px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted whitespace-nowrap";
const TD = "px-3 py-3 text-sm align-top";

export default async function CertificatesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; domain?: string; state?: string }>;
}) {
  await requireUser();
  const { year, domain, state } = await searchParams;

  const admin = supabaseAdmin();

  let query = admin.from("certificates").select("*");
  if (domain) query = query.eq("domain", domain);
  if (state === "revoked") query = query.not("revoked_at", "is", null);
  if (state === "active") query = query.is("revoked_at", null);
  if (year) {
    query = query.gte("issued_on", `${year}-01-01`).lte("issued_on", `${year}-12-31`);
  }

  const { data } = await query.order("certificate_id", { ascending: false }).limit(500);
  const certs = (data ?? []) as CertificateRow[];

  const { data: allData } = await admin.from("certificates").select("domain, issued_on, revoked_at");
  const all = (allData ?? []) as Pick<CertificateRow, "domain" | "issued_on" | "revoked_at">[];

  const domains = [...new Set(all.map((c) => c.domain).filter((d): d is string => !!d))].sort();
  const years = [...new Set(all.map((c) => c.issued_on.slice(0, 4)))].sort().reverse();
  const activeCount = all.filter((c) => !c.revoked_at).length;

  const link = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { year, domain, state, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const qs = p.toString();
    return qs ? `/admin/certificates?${qs}` : "/admin/certificates";
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Certificates</h1>
        <p className="mt-1 text-sm text-muted">
          {activeCount} active · {all.length - activeCount} revoked · {all.length} issued in total
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <FilterGroup label="Year" current={year} options={years} link={link} param="year" />
        <FilterGroup label="Domain" current={domain} options={domains} link={link} param="domain" />
        <FilterGroup
          label="State"
          current={state}
          options={["active", "revoked"]}
          link={link}
          param="state"
        />
      </div>

      {certs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-surface px-6 py-16 text-center">
          <p className="text-sm font-medium">No certificates match</p>
          <p className="mt-1 text-sm text-muted">
            Generate certificates from the{" "}
            <Link href="/admin" className="text-brand hover:underline">
              submissions table
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="table-scroll rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[900px] border-collapse">
            <thead className="border-b border-line bg-brand-soft/40">
              <tr>
                <th className={TH}>Certificate ID</th>
                <th className={TH}>Name</th>
                <th className={TH}>Domain</th>
                <th className={TH}>Duration</th>
                <th className={TH}>Issued</th>
                <th className={TH}>State</th>
                <th className={TH}>File</th>
              </tr>
            </thead>
            <tbody>
              {certs.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0 hover:bg-brand-soft/25">
                  <td className={TD}>
                    <Link
                      href={`/verify/${c.certificate_id}`}
                      target="_blank"
                      className="font-mono text-xs text-brand hover:underline"
                    >
                      {c.certificate_id}
                    </Link>
                    {c.version > 1 ? (
                      <span className="ml-1.5 text-xs text-muted">v{c.version}</span>
                    ) : null}
                  </td>
                  <td className={`${TD} font-medium`}>
                    <Link
                      href={`/admin/submissions/${c.submission_id}`}
                      className="hover:text-brand hover:underline"
                    >
                      {c.full_name}
                    </Link>
                  </td>
                  <td className={TD}>{c.domain ?? "—"}</td>
                  <td className={`${TD} whitespace-nowrap`}>{c.duration_text ?? "—"}</td>
                  <td className={`${TD} whitespace-nowrap`}>{formatDate(c.issued_on)}</td>
                  <td className={TD}>
                    {c.revoked_at ? (
                      <span
                        title={c.revoke_reason ?? undefined}
                        className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200"
                      >
                        revoked
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                        active
                      </span>
                    )}
                  </td>
                  <td className={TD}>
                    {c.revoked_at ? (
                      <span className="text-xs text-muted">—</span>
                    ) : (
                      <a
                        href={`/api/certificates/${c.certificate_id}/download`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-brand hover:underline"
                      >
                        PDF
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterGroup({
  label,
  current,
  options,
  link,
  param,
}: {
  label: string;
  current: string | undefined;
  options: string[];
  link: (patch: Record<string, string | undefined>) => string;
  param: string;
}) {
  if (options.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-medium text-muted">{label}:</span>
      <Link
        href={link({ [param]: undefined })}
        className={`rounded-full border px-2.5 py-0.5 text-xs ${
          !current ? "border-brand bg-brand-soft text-brand" : "border-line hover:bg-brand-soft/50"
        }`}
      >
        all
      </Link>
      {options.map((o) => (
        <Link
          key={o}
          href={link({ [param]: o })}
          className={`rounded-full border px-2.5 py-0.5 text-xs ${
            current === o ? "border-brand bg-brand-soft text-brand" : "border-line hover:bg-brand-soft/50"
          }`}
        >
          {o}
        </Link>
      ))}
    </div>
  );
}
