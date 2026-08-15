"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ALIGNS,
  applyTokens,
  FONT_NAMES,
  type Align,
  type FontName,
  type Layout,
  type LayoutField,
  type QrBox,
} from "@/config/template";
import { resetLayoutAction, saveLayoutAction } from "./actions";

/**
 * Drag-to-position editor for the certificate fields.
 *
 * The artwork is never touched — it is the background, and everything the
 * editor moves is drawn on top of it at generate time. Positions are template
 * pixels, converted from screen pixels through the displayed image width, so
 * the numbers stay correct at any zoom or window size.
 *
 * The browser ghosts are an aid, not the truth: the real renderer shrinks,
 * wraps and clips text using canvas font metrics that no CSS approximation can
 * reproduce. That is what the Preview button is for.
 */

const FIELD =
  "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";

const QR_ID = "__qr__";

/** Rough CSS stand-ins for the canvas fonts, for the on-image ghosts only. */
const CSS_FONT: Record<FontName, string> = {
  "Montserrat-Regular": "system-ui, sans-serif",
  "Montserrat-Bold": "system-ui, sans-serif",
  GreatVibes: "'Segoe Script', 'Brush Script MT', cursive",
};

export interface TokenInfo {
  token: string;
  description: string;
}

interface Props {
  initial: Layout;
  defaults: Layout;
  width: number;
  height: number;
  tokens: TokenInfo[];
  sample: Record<string, string>;
  canEdit: boolean;
}

type Selection = string | null;

function slugKey(label: string, taken: Set<string>): string {
  const base =
    label
      .trim()
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/^[^A-Za-z]+/, "") || "field";

  let key = base;
  let n = 2;
  while (taken.has(key)) key = `${base}-${n++}`;
  return key;
}

export function LayoutEditor({
  initial,
  defaults,
  width,
  height,
  tokens,
  sample,
  canEdit,
}: Props) {
  const [fields, setFields] = useState<LayoutField[]>(initial.fields);
  const [qr, setQr] = useState<QrBox>(initial.qr);
  const [saved, setSaved] = useState<Layout>(initial);
  const [selected, setSelected] = useState<Selection>(initial.fields[0]?.key ?? null);
  const [showGhosts, setShowGhosts] = useState(true);
  const [message, setMessage] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const [preview, setPreview] = useState<{ url: string; adjusted: string[] } | null>(null);
  const [previewSample, setPreviewSample] = useState("normal");
  const [previewing, setPreviewing] = useState(false);

  const imgRef = useRef<HTMLImageElement>(null);
  const [imageError, setImageError] = useState(false);

  const layout: Layout = useMemo(() => ({ fields, qr }), [fields, qr]);
  const dirty = useMemo(
    () => JSON.stringify(layout) !== JSON.stringify(saved),
    [layout, saved],
  );

  // Warn before losing unsaved drags — they are easy to accumulate and
  // impossible to redo from memory.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Blob URLs are only released when we replace or unmount them.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);

  const selectedField = fields.find((f) => f.key === selected) ?? null;

  const patchField = useCallback((key: string, patch: Partial<LayoutField>) => {
    setFields((list) => list.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  }, []);

  /** Screen delta → template pixels. */
  const scale = useCallback(() => {
    const rect = imgRef.current?.getBoundingClientRect();
    return rect && rect.width > 0 ? width / rect.width : 1;
  }, [width]);

  function startDrag(
    e: React.PointerEvent,
    id: string,
    mode: "move" | "resize" = "move",
  ) {
    if (!canEdit) return;
    e.preventDefault();
    e.stopPropagation();
    setSelected(id);

    const factor = scale();
    const startX = e.clientX;
    const startY = e.clientY;
    const origin =
      id === QR_ID
        ? { x: qr.x, y: qr.y, size: qr.size }
        : (() => {
            const f = fields.find((v) => v.key === id);
            return { x: f?.x ?? 0, y: f?.y ?? 0, size: 0 };
          })();

    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      const dx = Math.round((ev.clientX - startX) * factor);
      const dy = Math.round((ev.clientY - startY) * factor);

      if (id === QR_ID) {
        if (mode === "resize") {
          setQr((v) => ({ ...v, size: Math.max(40, Math.min(2000, origin.size + dx)) }));
        } else {
          setQr((v) => ({ ...v, x: origin.x + dx, y: origin.y + dy }));
        }
        return;
      }
      setFields((list) =>
        list.map((f) => (f.key === id ? { ...f, x: origin.x + dx, y: origin.y + dy } : f)),
      );
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  /** Arrow keys nudge the selection — the last pixel or two is never a drag. */
  function onCanvasKeyDown(e: React.KeyboardEvent) {
    if (!canEdit || !selected) return;
    const step = e.shiftKey ? 10 : 1;
    const delta =
      e.key === "ArrowLeft"
        ? [-step, 0]
        : e.key === "ArrowRight"
          ? [step, 0]
          : e.key === "ArrowUp"
            ? [0, -step]
            : e.key === "ArrowDown"
              ? [0, step]
              : null;
    if (!delta) return;

    e.preventDefault();
    if (selected === QR_ID) setQr((v) => ({ ...v, x: v.x + delta[0], y: v.y + delta[1] }));
    else patchField(selected, {
      x: (selectedField?.x ?? 0) + delta[0],
      y: (selectedField?.y ?? 0) + delta[1],
    });
  }

  function addField() {
    const taken = new Set(fields.map((f) => f.key));
    const key = slugKey("new-line", taken);
    const field: LayoutField = {
      key,
      label: "New line",
      text: "Text or {{name}}",
      x: Math.round(width / 2),
      y: Math.round(height / 2),
      align: "center",
      font: "Montserrat-Regular",
      size: 40,
      color: "#24384a",
      maxWidth: Math.round(width * 0.6),
      minSize: 24,
      enabled: true,
    };
    setFields((list) => [...list, field]);
    setSelected(key);
    setMessage(null);
  }

  function duplicateField(key: string) {
    const source = fields.find((f) => f.key === key);
    if (!source) return;
    const newKey = slugKey(`${source.key}-copy`, new Set(fields.map((f) => f.key)));
    setFields((list) => [...list, { ...source, key: newKey, y: source.y + 60 }]);
    setSelected(newKey);
  }

  function removeField(key: string) {
    setFields((list) => list.filter((f) => f.key !== key));
    if (selected === key) setSelected(null);
  }

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await saveLayoutAction(layout);
      if (result.error) setMessage({ kind: "error", text: result.error });
      else {
        setSaved(layout);
        setMessage({ kind: "ok", text: result.success ?? "Saved." });
      }
    });
  }

  function reset() {
    if (!window.confirm("Discard the saved layout and go back to the built-in defaults?")) return;
    setMessage(null);
    startTransition(async () => {
      const result = await resetLayoutAction();
      if (result.error) {
        setMessage({ kind: "error", text: result.error });
        return;
      }
      setFields(defaults.fields);
      setQr(defaults.qr);
      setSaved(defaults);
      setSelected(defaults.fields[0]?.key ?? null);
      setMessage({ kind: "ok", text: result.success ?? "Reset." });
    });
  }

  async function runPreview() {
    setPreviewing(true);
    setMessage(null);
    try {
      const response = await fetch("/api/template/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout, sample: previewSample }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: response.statusText }));
        setMessage({ kind: "error", text: body.error ?? "Preview failed." });
        return;
      }

      const adjusted = (response.headers.get("X-Adjusted-Fields") ?? "")
        .split(",")
        .filter(Boolean);
      const blob = await response.blob();
      if (preview) URL.revokeObjectURL(preview.url);
      setPreview({ url: URL.createObjectURL(blob), adjusted });
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setPreviewing(false);
    }
  }

  const pct = (v: number, total: number) => `${(v / total) * 100}%`;
  const unknownTokens = useMemo(() => {
    const known = new Set(tokens.map((t) => t.token));
    const found = new Set<string>();
    for (const f of fields) {
      for (const m of f.text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)) {
        if (!known.has(m[1])) found.add(m[1]);
      }
    }
    return [...found];
  }, [fields, tokens]);

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------------- toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={!canEdit || pending || !dirty}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : dirty ? "Save layout" : "Saved"}
        </button>

        <button
          type="button"
          onClick={addField}
          disabled={!canEdit}
          className="rounded-lg border border-line px-3 py-2 text-sm font-medium hover:border-brand hover:text-brand disabled:opacity-50"
        >
          + Add line
        </button>

        <div className="flex items-center gap-1.5">
          <select
            value={previewSample}
            onChange={(e) => setPreviewSample(e.target.value)}
            className="rounded-lg border border-line bg-surface px-2 py-2 text-sm"
            aria-label="Preview sample"
          >
            <option value="normal">Typical name</option>
            <option value="long">Very long name</option>
            <option value="short">Short name</option>
          </select>
          <button
            type="button"
            onClick={runPreview}
            disabled={previewing}
            className="rounded-lg border border-line px-3 py-2 text-sm font-medium hover:border-brand hover:text-brand disabled:opacity-50"
          >
            {previewing ? "Rendering…" : "Preview"}
          </button>
        </div>

        <button
          type="button"
          onClick={reset}
          disabled={!canEdit || pending}
          className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-muted hover:border-red-300 hover:text-red-700 disabled:opacity-50"
        >
          Reset to defaults
        </button>

        <label className="ml-auto flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showGhosts}
            onChange={(e) => setShowGhosts(e.target.checked)}
            className="h-4 w-4"
          />
          Show text preview
        </label>
      </div>

      {message ? (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={`rounded-lg border px-3 py-2 text-sm ${
            message.kind === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {message.text}
        </p>
      ) : null}

      {unknownTokens.length > 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Unknown placeholder{unknownTokens.length > 1 ? "s" : ""}:{" "}
          <code className="font-mono text-xs">
            {unknownTokens.map((t) => `{{${t}}}`).join(", ")}
          </code>
          . These print literally on the certificate.
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* ------------------------------------------------------------ canvas */}
        <div
          tabIndex={0}
          onKeyDown={onCanvasKeyDown}
          onClick={() => setSelected(null)}
          // A container query context: the ghost text is sized in cqw so it
          // stays proportional to the artwork however wide the panel is.
          style={{ containerType: "inline-size" }}
          className="relative touch-none overflow-hidden rounded-xl border border-line bg-surface outline-none focus:border-brand"
        >
          {imageError ? (
            <div className="px-6 py-16 text-center text-sm text-red-700">
              Could not load the artwork. Check that the file named in{" "}
              <code className="font-mono text-xs">src/config/template.ts</code> exists.
            </div>
          ) : (
            <>
              {/* Intentionally a plain img, not next/image: this is a dynamic
                  authenticated route, and the whole feature depends on the
                  rendered size mapping cleanly back to template pixels. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src="/api/template/image"
                alt="Certificate artwork"
                onError={() => setImageError(true)}
                className="block w-full select-none"
                draggable={false}
              />

              {fields.map((f) => {
                const isSelected = selected === f.key;
                const ghost = applyTokens(f.text, sample) || f.text;
                const shift =
                  f.align === "center"
                    ? "translate(-50%, -100%)"
                    : f.align === "right"
                      ? "translate(-100%, -100%)"
                      : "translate(0, -100%)";

                return (
                  <div
                    key={f.key}
                    className="absolute"
                    style={{ left: pct(f.x, width), top: pct(f.y, height) }}
                  >
                    {showGhosts ? (
                      <span
                        className="pointer-events-none absolute whitespace-nowrap"
                        style={{
                          transform: shift,
                          fontFamily: CSS_FONT[f.font],
                          fontWeight: f.font === "Montserrat-Bold" ? 700 : 400,
                          // Template pixels scale with the image, so sizing in
                          // cqw keeps the ghost proportional at any width.
                          fontSize: `${(f.size / width) * 100}cqw`,
                          color: f.color,
                          opacity: f.enabled ? 0.85 : 0.3,
                          textTransform: f.uppercase ? "uppercase" : "none",
                        }}
                      >
                        {ghost}
                      </span>
                    ) : null}

                    <span
                      className={`absolute -left-px -top-2 h-4 w-px ${
                        isSelected ? "bg-red-600" : "bg-fuchsia-600"
                      }`}
                    />
                    <span
                      className={`absolute -left-2 -top-px h-px w-4 ${
                        isSelected ? "bg-red-600" : "bg-fuchsia-600"
                      }`}
                    />
                    <button
                      type="button"
                      onPointerDown={(e) => startDrag(e, f.key)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected(f.key);
                      }}
                      title={`${f.label} — drag to move`}
                      className={`absolute left-2.5 -top-2 cursor-grab rounded px-1 text-[10px] leading-4 whitespace-nowrap text-white active:cursor-grabbing ${
                        isSelected ? "bg-red-600" : f.enabled ? "bg-fuchsia-600" : "bg-slate-400"
                      }`}
                    >
                      {f.key}
                    </button>
                  </div>
                );
              })}

              <div
                className={`absolute border-2 border-dashed ${
                  selected === QR_ID ? "border-red-600" : "border-cyan-600"
                } ${qr.enabled ? "" : "opacity-40"}`}
                style={{
                  left: pct(qr.x, width),
                  top: pct(qr.y, height),
                  width: pct(qr.size, width),
                  height: pct(qr.size, height),
                }}
                onPointerDown={(e) => startDrag(e, QR_ID)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelected(QR_ID);
                }}
                role="presentation"
              >
                <span className="absolute left-0 -top-4 cursor-grab bg-cyan-600 px-1 text-[10px] leading-4 text-white">
                  qr
                </span>
                <span
                  onPointerDown={(e) => startDrag(e, QR_ID, "resize")}
                  className="absolute -right-1.5 -bottom-1.5 h-3 w-3 cursor-se-resize rounded-sm bg-cyan-600"
                  role="presentation"
                />
              </div>
            </>
          )}
        </div>

        {/* --------------------------------------------------------- inspector */}
        <div className="space-y-3">
          {selected === QR_ID ? (
            <QrInspector qr={qr} onChange={setQr} disabled={!canEdit} />
          ) : selectedField ? (
            <FieldInspector
              field={selectedField}
              tokens={tokens}
              disabled={!canEdit}
              onChange={(patch) => patchField(selectedField.key, patch)}
              onDuplicate={() => duplicateField(selectedField.key)}
              onRemove={() => removeField(selectedField.key)}
            />
          ) : (
            <p className="rounded-xl border border-line bg-surface px-4 py-6 text-sm text-muted">
              Select a marker on the artwork — or a row below — to edit it. Drag a marker to move
              it, or use the arrow keys (hold Shift for 10px steps).
            </p>
          )}
        </div>
      </div>

      {/* -------------------------------------------------------------- fields */}
      <section className="rounded-xl border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">
            Lines on the certificate{" "}
            <span className="font-normal text-muted">· {fields.length}</span>
          </h2>
          <p className="text-xs text-muted">
            Untick &ldquo;Print&rdquo; to keep a line&rsquo;s position but leave it off.
          </p>
        </div>
        <div className="table-scroll">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead className="bg-brand-soft/40">
              <tr>
                {["Print", "Line", "Prints", "x", "y", "Size", "Align", ""].map((h) => (
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
              {fields.map((f) => (
                <tr
                  key={f.key}
                  onClick={() => setSelected(f.key)}
                  className={`cursor-pointer border-t border-line ${
                    selected === f.key ? "bg-brand-soft/40" : "hover:bg-brand-soft/20"
                  }`}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={f.enabled}
                      disabled={!canEdit}
                      onChange={(e) => patchField(f.key, { enabled: e.target.checked })}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4"
                      aria-label={`Print ${f.label}`}
                    />
                  </td>
                  <td className="px-3 py-2 font-medium">
                    {f.label}
                    <span className="ml-1.5 font-mono text-xs text-muted">{f.key}</span>
                  </td>
                  <td className="max-w-[220px] truncate px-3 py-2 font-mono text-xs text-muted">
                    {f.text}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{f.x}</td>
                  <td className="px-3 py-2 font-mono text-xs">{f.y}</td>
                  <td className="px-3 py-2 font-mono text-xs">{f.size}</td>
                  <td className="px-3 py-2 text-muted">{f.align}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeField(f.key);
                      }}
                      className="rounded border border-line px-2 py-0.5 text-xs text-muted hover:border-red-300 hover:text-red-700 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {fields.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-sm text-muted">
                    No lines. The certificate would print as bare artwork.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {/* ------------------------------------------------------------- preview */}
      {preview ? (
        <section className="space-y-2 rounded-xl border border-line bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Rendered preview</h2>
            <div className="flex items-center gap-2">
              <a
                href={preview.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-brand underline"
              >
                Open full size
              </a>
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(preview.url);
                  setPreview(null);
                }}
                className="rounded border border-line px-2 py-0.5 text-xs text-muted hover:text-brand"
              >
                Close
              </button>
            </div>
          </div>

          {preview.adjusted.length > 0 ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Auto-fitted to stay inside its width:{" "}
              <span className="font-mono">{preview.adjusted.join(", ")}</span>. Raise{" "}
              <code className="font-mono">max width</code> or lower the size if that looks wrong.
            </p>
          ) : null}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview.url}
            alt="Rendered sample certificate"
            className="block w-full rounded-lg border border-line"
          />
        </section>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- inspectors */

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-2 text-sm">
      <span className="text-muted">{label}</span>
      {children}
    </label>
  );
}

function NumberBox({
  value,
  onChange,
  disabled,
  placeholder,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <input
      type="number"
      value={value ?? ""}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => {
        const raw = e.target.value;
        onChange(raw === "" ? undefined : Math.round(Number(raw)));
      }}
      className={FIELD}
    />
  );
}

function FieldInspector({
  field,
  tokens,
  disabled,
  onChange,
  onDuplicate,
  onRemove,
}: {
  field: LayoutField;
  tokens: TokenInfo[];
  disabled: boolean;
  onChange: (patch: Partial<LayoutField>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">{field.label}</h2>
        <code className="font-mono text-xs text-muted">{field.key}</code>
      </div>

      <Row label="Name">
        <input
          value={field.label}
          disabled={disabled}
          onChange={(e) => onChange({ label: e.target.value })}
          className={FIELD}
        />
      </Row>

      <div className="space-y-1.5">
        <span className="text-sm text-muted">Prints</span>
        <textarea
          value={field.text}
          rows={2}
          disabled={disabled}
          onChange={(e) => onChange({ text: e.target.value })}
          className={`${FIELD} font-mono text-xs`}
        />
        <div className="flex flex-wrap gap-1">
          {tokens.map((t) => (
            <button
              key={t.token}
              type="button"
              title={t.description}
              disabled={disabled}
              onClick={() => onChange({ text: `${field.text}{{${t.token}}}` })}
              className="rounded border border-line px-1.5 py-0.5 font-mono text-[10px] hover:border-brand hover:text-brand disabled:opacity-50"
            >
              {`{{${t.token}}}`}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Row label="x">
          <NumberBox value={field.x} disabled={disabled} onChange={(v) => onChange({ x: v ?? 0 })} />
        </Row>
        <Row label="y">
          <NumberBox value={field.y} disabled={disabled} onChange={(v) => onChange({ y: v ?? 0 })} />
        </Row>
      </div>

      <Row label="Align">
        <select
          value={field.align}
          disabled={disabled}
          onChange={(e) => onChange({ align: e.target.value as Align })}
          className={FIELD}
        >
          {ALIGNS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </Row>

      <Row label="Font">
        <select
          value={field.font}
          disabled={disabled}
          onChange={(e) => onChange({ font: e.target.value as FontName })}
          className={FIELD}
        >
          {FONT_NAMES.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </Row>

      <Row label="Size">
        <NumberBox
          value={field.size}
          disabled={disabled}
          onChange={(v) => onChange({ size: v ?? 12 })}
        />
      </Row>

      <Row label="Colour">
        <span className="flex items-center gap-2">
          <input
            type="color"
            value={field.color}
            disabled={disabled}
            onChange={(e) => onChange({ color: e.target.value })}
            className="h-8 w-10 rounded border border-line bg-surface"
          />
          <input
            value={field.color}
            disabled={disabled}
            onChange={(e) => onChange({ color: e.target.value })}
            className={`${FIELD} font-mono text-xs`}
          />
        </span>
      </Row>

      <Row label="Max width">
        <NumberBox
          value={field.maxWidth}
          placeholder="no limit"
          disabled={disabled}
          onChange={(v) => onChange({ maxWidth: v })}
        />
      </Row>

      <Row label="Min size">
        <NumberBox
          value={field.minSize}
          placeholder="never shrink"
          disabled={disabled}
          onChange={(v) => onChange({ minSize: v })}
        />
      </Row>

      <div className="flex flex-wrap gap-4 pt-1 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={field.enabled}
            disabled={disabled}
            onChange={(e) => onChange({ enabled: e.target.checked })}
            className="h-4 w-4"
          />
          Print
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={field.wrap ?? false}
            disabled={disabled}
            onChange={(e) => onChange({ wrap: e.target.checked || undefined })}
            className="h-4 w-4"
          />
          Wrap to 2 lines
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={field.uppercase ?? false}
            disabled={disabled}
            onChange={(e) => onChange({ uppercase: e.target.checked || undefined })}
            className="h-4 w-4"
          />
          UPPERCASE
        </label>
      </div>

      <div className="flex gap-2 border-t border-line pt-3">
        <button
          type="button"
          onClick={onDuplicate}
          disabled={disabled}
          className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:border-brand hover:text-brand disabled:opacity-50"
        >
          Duplicate
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted hover:border-red-300 hover:text-red-700 disabled:opacity-50"
        >
          Remove line
        </button>
      </div>
    </div>
  );
}

function QrInspector({
  qr,
  onChange,
  disabled,
}: {
  qr: QrBox;
  onChange: (next: QrBox) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold">Verification QR</h2>
      <p className="text-xs text-muted">
        Encodes the public verify link for the certificate&rsquo;s ID — not the student&rsquo;s
        details, so revoking one takes effect immediately.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <Row label="x">
          <NumberBox
            value={qr.x}
            disabled={disabled}
            onChange={(v) => onChange({ ...qr, x: v ?? 0 })}
          />
        </Row>
        <Row label="y">
          <NumberBox
            value={qr.y}
            disabled={disabled}
            onChange={(v) => onChange({ ...qr, y: v ?? 0 })}
          />
        </Row>
      </div>

      <Row label="Size">
        <NumberBox
          value={qr.size}
          disabled={disabled}
          onChange={(v) => onChange({ ...qr, size: v ?? 190 })}
        />
      </Row>

      <Row label="Quiet zone">
        <NumberBox
          value={qr.margin}
          disabled={disabled}
          onChange={(v) => onChange({ ...qr, margin: v ?? 2 })}
        />
      </Row>

      <Row label="Dark">
        <input
          type="color"
          value={qr.dark}
          disabled={disabled}
          onChange={(e) => onChange({ ...qr, dark: e.target.value })}
          className="h-8 w-full rounded border border-line bg-surface"
        />
      </Row>

      <Row label="Light">
        <input
          type="color"
          value={qr.light}
          disabled={disabled}
          onChange={(e) => onChange({ ...qr, light: e.target.value })}
          className="h-8 w-full rounded border border-line bg-surface"
        />
      </Row>

      <label className="flex items-center gap-2 pt-1 text-sm">
        <input
          type="checkbox"
          checked={qr.enabled}
          disabled={disabled}
          onChange={(e) => onChange({ ...qr, enabled: e.target.checked })}
          className="h-4 w-4"
        />
        Print the QR code
      </label>

      <p className="text-xs text-muted">
        Below about 150px the code stops scanning reliably once printed.
      </p>
    </div>
  );
}
