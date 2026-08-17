import fs from "node:fs";
import path from "node:path";
import { requireUser } from "@/lib/auth";
import { DEFAULT_LAYOUT, TEMPLATE, TOKENS } from "@/config/template";
import { loadLayout } from "@/lib/certificate/layout";
import { LayoutEditor } from "./LayoutEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Template · TS-Certify" };

/** The values the on-image ghosts are drawn with, so tokens read as real text. */
const SAMPLE: Record<string, string> = {
  name: "Aarav Sharma",
  firstName: "Aarav",
  domain: "Web Development",
  duration: "8 Weeks (12 Jan 2026 to 09 Mar 2026)",
  startDate: "12 Jan 2026",
  endDate: "09 Mar 2026",
  institution: "Delhi Technological University",
  certificateId: "TS-2026-0001",
  issuedOn: "15 Aug 2026",
  orgName: "Tech-Synergy Services",
};

export default async function TemplatePage() {
  const user = await requireUser();

  const abs = path.join(process.cwd(), TEMPLATE.file);
  const exists = fs.existsSync(abs);
  const layout = await loadLayout();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Certificate template</h1>
        <p className="mt-1 text-sm text-muted">
          Drag a marker to move what gets printed. Add lines, remove them, or switch one off — the
          artwork underneath is never modified.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-line bg-surface px-4 py-3 text-xs text-muted">
        <span>
          Artwork <code className="font-mono">{TEMPLATE.file}</code>
        </span>
        <span>
          {TEMPLATE.width} × {TEMPLATE.height} px
        </span>
        <span>
          Key <code className="font-mono">{TEMPLATE.key}</code>
        </span>
        <span>
          Positions:{" "}
          {layout.source === "database" ? (
            <>
              saved
              {layout.updatedAt
                ? ` · ${new Date(layout.updatedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`
                : null}
            </>
          ) : (
            "built-in defaults"
          )}
        </span>
      </div>

      {layout.problem ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-medium">Falling back to the default positions</p>
          <p className="mt-1">{layout.problem}</p>
          <p className="mt-1">
            If this mentions a missing table, apply{" "}
            <code className="font-mono text-xs">supabase/005_certificate_layout.sql</code> in the
            Supabase SQL editor — until then, edits here cannot be saved.
          </p>
        </div>
      ) : null}

      {!exists ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-medium">Artwork missing</p>
          <p className="mt-1">
            Nothing found at <code className="font-mono text-xs">{TEMPLATE.file}</code>. Put the
            design there — the renderer only composites on top of it, so it is never overwritten.
            If you replace it with a differently-sized image, update{" "}
            <code className="font-mono text-xs">width</code> and{" "}
            <code className="font-mono text-xs">height</code> in{" "}
            <code className="font-mono text-xs">src/config/template.ts</code> to match.
          </p>
        </div>
      ) : (
        <LayoutEditor
          initial={{ fields: layout.fields, qr: layout.qr }}
          defaults={DEFAULT_LAYOUT}
          width={TEMPLATE.width}
          height={TEMPLATE.height}
          tokens={[...TOKENS]}
          sample={SAMPLE}
          canEdit={user.can.editTemplateLayout}
        />
      )}

      <section className="rounded-xl border border-line bg-surface p-5 text-sm text-muted">
        <h2 className="mb-2 text-sm font-semibold text-foreground">How positions work</h2>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            Coordinates are pixels on the artwork itself, and <strong>y is the baseline</strong> —
            the line the letters sit on, not the top of them.
          </li>
          <li>
            <code className="font-mono text-xs">Align</code> decides whether the marker is the left
            edge, the centre or the right edge of the text.
          </li>
          <li>
            A long name is shrunk towards <code className="font-mono text-xs">min size</code>, then
            wrapped if wrapping is on, then clipped with an ellipsis. Preview with the
            &ldquo;very long name&rdquo; sample before trusting a width.
          </li>
          <li>
            Saving affects certificates generated <em>afterwards</em>. Already-issued PDFs are
            frozen; re-generate a submission to move it onto the new layout.
          </li>
        </ul>
      </section>
    </div>
  );
}
