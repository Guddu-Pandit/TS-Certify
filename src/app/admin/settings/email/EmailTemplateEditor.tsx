"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { saveEmailTemplate, type TemplateFormState } from "./actions";

const FIELD =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";

/** Mirrors PLACEHOLDERS in src/lib/email/template.ts. */
export interface PlaceholderInfo {
  token: string;
  description: string;
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save template"}
    </button>
  );
}

/** Client-side twin of render() — same rules, used only for the preview. */
function substitute(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (whole, token: string) =>
    token in values ? values[token] : whole,
  );
}

export function EmailTemplateEditor({
  initial,
  placeholders,
  sample,
}: {
  initial: { subject: string; body_html: string; body_text: string; attachment_name: string };
  placeholders: PlaceholderInfo[];
  sample: Record<string, string>;
}) {
  const [state, formAction] = useActionState<TemplateFormState, FormData>(saveEmailTemplate, {
    error: null,
    success: null,
  });

  const [subject, setSubject] = useState(initial.subject);
  const [bodyHtml, setBodyHtml] = useState(initial.body_html);
  const [bodyText, setBodyText] = useState(initial.body_text);
  const [attachment, setAttachment] = useState(initial.attachment_name);
  const [tab, setTab] = useState<"html" | "text">("html");

  const preview = useMemo(
    () => ({
      subject: substitute(subject, sample),
      html: substitute(bodyHtml, sample),
      text: substitute(bodyText, sample),
      attachment: substitute(attachment, sample).replace(/[\\/:*?"<>|]+/g, "-"),
    }),
    [subject, bodyHtml, bodyText, attachment, sample],
  );

  // Flags a typo like {{studentName}} before it goes out to a real student.
  const unknownTokens = useMemo(() => {
    const known = new Set(placeholders.map((p) => p.token));
    const found = new Set<string>();
    for (const source of [subject, bodyHtml, bodyText, attachment]) {
      for (const m of source.matchAll(/\{\{\s*(\w+)\s*\}\}/g)) {
        if (!known.has(m[1])) found.add(m[1]);
      }
    }
    return [...found];
  }, [subject, bodyHtml, bodyText, attachment, placeholders]);

  function insert(token: string) {
    const snippet = `{{${token}}}`;
    if (tab === "html") setBodyHtml((v) => v + snippet);
    else setBodyText((v) => v + snippet);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form action={formAction} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="subject" className="block text-sm font-medium">
            Subject
          </label>
          <input
            id="subject"
            name="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className={FIELD}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="attachment_name" className="block text-sm font-medium">
            Attachment filename
          </label>
          <input
            id="attachment_name"
            name="attachment_name"
            value={attachment}
            onChange={(e) => setAttachment(e.target.value)}
            className={FIELD}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTab("html")}
              className={`rounded-lg px-3 py-1 text-sm font-medium ${
                tab === "html" ? "bg-brand-soft text-brand" : "text-muted hover:bg-brand-soft/60"
              }`}
            >
              HTML body
            </button>
            <button
              type="button"
              onClick={() => setTab("text")}
              className={`rounded-lg px-3 py-1 text-sm font-medium ${
                tab === "text" ? "bg-brand-soft text-brand" : "text-muted hover:bg-brand-soft/60"
              }`}
            >
              Plain text
            </button>
          </div>

          {/* Both are always submitted — the tabs only switch which one is
              visible. Email clients that block HTML fall back to the text
              version, so it must stay in sync. */}
          <textarea
            name="body_html"
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
            rows={16}
            className={`${FIELD} font-mono text-xs ${tab === "html" ? "" : "hidden"}`}
          />
          <textarea
            name="body_text"
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            rows={16}
            className={`${FIELD} font-mono text-xs ${tab === "text" ? "" : "hidden"}`}
          />
        </div>

        <div className="space-y-2 rounded-lg border border-line bg-brand-soft/25 p-3">
          <p className="text-xs font-semibold">Click to insert a placeholder</p>
          <div className="flex flex-wrap gap-1.5">
            {placeholders.map((p) => (
              <button
                key={p.token}
                type="button"
                title={p.description}
                onClick={() => insert(p.token)}
                className="rounded border border-line bg-surface px-2 py-0.5 font-mono text-xs hover:border-brand hover:text-brand"
              >
                {`{{${p.token}}}`}
              </button>
            ))}
          </div>
        </div>

        {unknownTokens.length > 0 ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Unknown placeholder{unknownTokens.length > 1 ? "s" : ""}:{" "}
            <code className="font-mono text-xs">
              {unknownTokens.map((t) => `{{${t}}}`).join(", ")}
            </code>
            . These will be sent to students literally, not replaced.
          </p>
        ) : null}

        {state.error ? (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {state.success}
          </p>
        ) : null}

        <Submit />
      </form>

      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Live preview</h2>
          <span className="text-xs text-muted">with sample student data</span>
        </div>

        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className="space-y-1 border-b border-line bg-brand-soft/25 px-4 py-3 text-sm">
            <p>
              <span className="text-muted">Subject: </span>
              <span className="font-medium">{preview.subject}</span>
            </p>
            <p className="text-xs text-muted">
              Attachment: <span className="font-mono">{preview.attachment}</span>
            </p>
          </div>

          {tab === "html" ? (
            // Preview only, rendered from copy the admin just typed — it never
            // displays student-supplied content.
            <div
              className="px-4 py-4 text-sm [&_a]:text-brand [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: preview.html }}
            />
          ) : (
            <pre className="overflow-x-auto px-4 py-4 text-xs whitespace-pre-wrap">
              {preview.text}
            </pre>
          )}
        </div>

        <p className="text-xs text-muted">
          The certificate PDF is attached to every message as a real file, not a link — expiring
          links would break, and a link-only certificate email looks like phishing.
        </p>
      </div>
    </div>
  );
}
