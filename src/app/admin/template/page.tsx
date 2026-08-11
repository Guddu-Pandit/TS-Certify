import fs from "node:fs";
import path from "node:path";
import { requireUser } from "@/lib/auth";
import { TEMPLATE } from "@/config/template";
import { Calibrator } from "./Calibrator";

export const dynamic = "force-dynamic";
export const metadata = { title: "Template · TS-Certify" };

export default async function TemplatePage() {
  await requireUser();

  const abs = path.join(process.cwd(), TEMPLATE.file);
  const exists = fs.existsSync(abs);

  const fields = Object.entries(TEMPLATE.fields).map(([key, f]) => ({
    key,
    x: f.x,
    y: f.y,
    align: f.align,
    size: f.size,
  }));

  const printed = new Set<string>(TEMPLATE.print);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Certificate template</h1>
        <p className="mt-1 text-sm text-muted">
          Click the image to read coordinates, then paste them into{" "}
          <code className="font-mono text-xs">src/config/template.ts</code>.
        </p>
      </div>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold">Using your own design</h2>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted">
          <li>
            Save it as <code className="font-mono text-xs">{TEMPLATE.file}</code>, replacing the
            placeholder.
          </li>
          <li>
            Set <code className="font-mono text-xs">width</code> and{" "}
            <code className="font-mono text-xs">height</code> in{" "}
            <code className="font-mono text-xs">src/config/template.ts</code> to its exact pixel
            size. The renderer refuses to run on a mismatch rather than silently producing
            misaligned certificates.
          </li>
          <li>Reload this page, click where each field belongs, and update the coordinates.</li>
          <li>
            Run <code className="font-mono text-xs">npm run render:sample</code> to check the
            result — including a deliberately very long name — in about a second.
          </li>
        </ol>
      </section>

      {!exists ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-medium">Template image missing</p>
          <p className="mt-1">
            Nothing found at <code className="font-mono text-xs">{TEMPLATE.file}</code>. Put your
            design there, or run{" "}
            <code className="font-mono text-xs">node scripts/make-placeholder-template.mjs</code>.
          </p>
        </div>
      ) : (
        <Calibrator
          width={TEMPLATE.width}
          height={TEMPLATE.height}
          fields={fields}
          qr={{ x: TEMPLATE.qr.x, y: TEMPLATE.qr.y, size: TEMPLATE.qr.size }}
        />
      )}

      <section className="rounded-xl border border-line bg-surface">
        <div className="border-b border-line px-5 py-3">
          <h2 className="text-sm font-semibold">
            Current settings{" "}
            <span className="font-normal text-muted">
              · {TEMPLATE.width} × {TEMPLATE.height} · key {TEMPLATE.key}
            </span>
          </h2>
        </div>
        <div className="table-scroll">
          <table className="w-full min-w-[600px] border-collapse text-sm">
            <thead className="bg-brand-soft/40">
              <tr>
                {["Field", "x", "y", "Align", "Size", "Font", "Printed"].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(TEMPLATE.fields).map(([key, f]) => (
                <tr key={key} className="border-t border-line">
                  <td className="px-3 py-2 font-medium">{key}</td>
                  <td className="px-3 py-2 font-mono text-xs">{f.x}</td>
                  <td className="px-3 py-2 font-mono text-xs">{f.y}</td>
                  <td className="px-3 py-2 text-muted">{f.align}</td>
                  <td className="px-3 py-2 font-mono text-xs">{f.size}</td>
                  <td className="px-3 py-2 text-muted">{f.font}</td>
                  <td className="px-3 py-2">
                    {printed.has(key) ? (
                      <span className="text-emerald-700">yes</span>
                    ) : (
                      <span className="text-muted">no</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-line px-5 py-3 text-xs text-muted">
          A field marked &ldquo;no&rdquo; keeps its coordinates but is not drawn. Control this with
          the <code className="font-mono">print</code> list in the config —{" "}
          <code className="font-mono">institution</code> is off by default.
        </p>
      </section>
    </div>
  );
}
