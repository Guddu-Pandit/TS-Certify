"use client";

import { useRef, useState } from "react";

interface FieldMarker {
  key: string;
  x: number;
  y: number;
  align: string;
  size: number;
}

export function Calibrator({
  width,
  height,
  fields,
  qr,
}: {
  width: number;
  height: number;
  fields: FieldMarker[];
  qr: { x: number; y: number; size: number };
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [click, setClick] = useState<{ x: number; y: number } | null>(null);
  const [showMarkers, setShowMarkers] = useState(true);
  const [imageError, setImageError] = useState(false);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const img = imgRef.current;
    if (!img) return;

    const rect = img.getBoundingClientRect();
    // Convert the on-screen click back into template pixels. The image is
    // displayed scaled to fit, so this ratio is what makes the numbers usable.
    const scale = width / rect.width;
    const x = Math.round((e.clientX - rect.left) * scale);
    const y = Math.round((e.clientY - rect.top) * scale);

    if (x < 0 || y < 0 || x > width || y > height) return;
    setClick({ x, y });
  }

  const pct = (v: number, total: number) => `${(v / total) * 100}%`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showMarkers}
            onChange={(e) => setShowMarkers(e.target.checked)}
            className="h-4 w-4"
          />
          Show current field positions
        </label>

        {click ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm">
            <span className="text-muted">Clicked:</span>
            <code className="font-mono text-brand">
              x: {click.x}, y: {click.y}
            </code>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(`x: ${click.x}, y: ${click.y},`)}
              className="rounded border border-line px-2 py-0.5 text-xs hover:bg-brand-soft"
            >
              Copy
            </button>
          </div>
        ) : (
          <p className="text-sm text-muted">Click anywhere on the template to read its coordinates.</p>
        )}
      </div>

      <div
        onClick={handleClick}
        className="relative cursor-crosshair overflow-hidden rounded-xl border border-line bg-surface"
      >
        {imageError ? (
          <div className="px-6 py-16 text-center text-sm text-red-700">
            Could not load the template image. Check that the file named in{" "}
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
              alt="Certificate template"
              onError={() => setImageError(true)}
              className="block w-full select-none"
              draggable={false}
            />

            {showMarkers
              ? fields.map((f) => (
                  <div
                    key={f.key}
                    className="pointer-events-none absolute"
                    style={{ left: pct(f.x, width), top: pct(f.y, height) }}
                  >
                    <div className="absolute -left-2 -top-px h-px w-4 bg-fuchsia-600" />
                    <div className="absolute -left-px -top-2 h-4 w-px bg-fuchsia-600" />
                    <span className="absolute left-2.5 -top-2 rounded bg-fuchsia-600 px-1 text-[10px] leading-4 whitespace-nowrap text-white">
                      {f.key}
                    </span>
                  </div>
                ))
              : null}

            {showMarkers ? (
              <div
                className="pointer-events-none absolute border-2 border-dashed border-cyan-600"
                style={{
                  left: pct(qr.x, width),
                  top: pct(qr.y, height),
                  width: pct(qr.size, width),
                  height: pct(qr.size, height),
                }}
              >
                <span className="absolute left-0 -top-4 bg-cyan-600 px-1 text-[10px] leading-4 text-white">
                  qr
                </span>
              </div>
            ) : null}

            {click ? (
              <div
                className="pointer-events-none absolute"
                style={{ left: pct(click.x, width), top: pct(click.y, height) }}
              >
                <div className="absolute -left-3 -top-px h-px w-6 bg-red-600" />
                <div className="absolute -left-px -top-3 h-6 w-px bg-red-600" />
              </div>
            ) : null}
          </>
        )}
      </div>

      <p className="text-xs text-muted">
        Markers sit on each field&rsquo;s <strong>baseline</strong> — the line text sits on, not the
        top of the letters. The <code className="font-mono">align</code> setting decides whether the
        marker is the left edge, centre, or right edge of the text.
      </p>
    </div>
  );
}
