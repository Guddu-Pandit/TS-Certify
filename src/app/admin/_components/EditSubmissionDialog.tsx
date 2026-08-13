"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  EDITABLE_FIELDS,
  isBlank,
  missingFields,
  type EditableFieldDef,
} from "@/config/editable-fields";
import {
  clearManualOverrides,
  updateSubmission,
  type EditSubmissionState,
} from "../submissions/actions";

// Lives here, not next to the action: a "use server" module may only export
// async functions, so a shared constant there breaks the build.
const IDLE: EditSubmissionState = { error: null, success: null };

/**
 * The shape the dialog needs. Both `AdminSubmissionRow` (from the table) and
 * `SubmissionRow` (from the detail page) satisfy it, so one dialog serves
 * both without either page converting anything.
 */
export interface EditableSubmission {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  domain: string | null;
  institution: string | null;
  start_date: string | null;
  end_date: string | null;
  notes?: string | null;
  submitted_at?: string | null;
  extra?: Record<string, unknown>;
  manual_overrides?: Record<string, unknown>;
  edited_at?: string | null;
}

const FIELD =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";
const FIELD_MISSING = "border-amber-300 bg-amber-50/60 focus:border-amber-500 focus:ring-amber-500/15";

export function EditSubmissionDialog({
  submission,
  onClose,
}: {
  submission: EditableSubmission;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState<EditSubmissionState, FormData>(
    updateSubmission,
    IDLE,
  );
  const [releaseState, setReleaseState] = useState<EditSubmissionState>(IDLE);
  const [releasing, startRelease] = useTransition();

  const overrides = submission.manual_overrides ?? {};
  const overriddenColumns = new Set(Object.keys(overrides));
  const missing = missingFields(submission);
  const extra = Object.entries(submission.extra ?? {});

  // Close once the write lands, and re-run the server component so the row
  // behind the dialog shows the new values rather than the stale ones.
  useEffect(() => {
    if (!state.success) return;
    router.refresh();
    onClose();
  }, [state.success, router, onClose]);

  // Escape closes. Attached to the document, not the panel, so it works even
  // before anything inside has been focused.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Stop the page behind from scrolling while the dialog is open.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  function release() {
    startRelease(async () => {
      const result = await clearManualOverrides(submission.id);
      setReleaseState(result);
      if (result.success) router.refresh();
    });
  }

  const message = state.error ?? releaseState.error ?? releaseState.success ?? null;
  const messageIsBad = Boolean(state.error ?? releaseState.error);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 p-4 sm:p-8"
      // Only a click that both starts and ends on the backdrop closes, so
      // dragging to select text inside the panel does not dismiss it.
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-submission-title"
        className="w-full max-w-3xl overflow-hidden rounded-xl border border-line bg-surface shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id="edit-submission-title" className="truncate text-base font-bold tracking-tight">
              {submission.full_name || "Unnamed submission"}
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              {missing.length > 0 ? (
                <span className="text-amber-800">
                  {missing.length} field{missing.length === 1 ? "" : "s"} the form did not fill in
                </span>
              ) : (
                "All fields present — edit anything that is wrong."
              )}
              {submission.edited_at ? (
                <> · edited by hand {new Date(submission.edited_at).toLocaleDateString()}</>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-lg border border-line px-2 py-1 text-sm text-muted transition hover:bg-brand-soft hover:text-brand"
          >
            ✕
          </button>
        </div>

        <form action={formAction}>
          <input type="hidden" name="id" value={submission.id} />

          <div className="max-h-[65vh] space-y-4 overflow-y-auto px-5 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {EDITABLE_FIELDS.filter((f) => f.type !== "textarea").map((field) => (
                <FieldInput
                  key={field.column}
                  field={field}
                  value={submission[field.column]}
                  overridden={overriddenColumns.has(field.column)}
                  // Land the cursor on the first thing that needs typing.
                  autoFocus={missing[0]?.column === field.column}
                />
              ))}
            </div>

            {EDITABLE_FIELDS.filter((f) => f.type === "textarea").map((field) => (
              <FieldInput
                key={field.column}
                field={field}
                value={submission[field.column]}
                overridden={overriddenColumns.has(field.column)}
              />
            ))}

            {/* The missing value is very often sitting in a column no field
                claims yet — showing them here saves a trip to the sheet. */}
            {extra.length > 0 ? (
              <details className="rounded-lg border border-line bg-brand-soft/30 px-3 py-2">
                <summary className="cursor-pointer text-xs font-semibold">
                  Other answers from the form ({extra.length})
                </summary>
                <dl className="mt-2 space-y-1">
                  {extra.map(([key, value]) => (
                    <div key={key} className="flex flex-wrap gap-x-3 text-xs">
                      <dt className="min-w-40 text-muted">{key}</dt>
                      <dd className="break-all font-medium">{String(value) || "—"}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            ) : null}

            <p className="text-xs text-muted">
              Edited fields are kept when the sheet is re-synced. Certificates already issued are
              not changed — re-generate to pick these values up.
            </p>

            {message ? (
              <p
                role={messageIsBad ? "alert" : "status"}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  messageIsBad
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
              >
                {message}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-brand-soft/20 px-5 py-3">
            <div>
              {overriddenColumns.size > 0 ? (
                <button
                  type="button"
                  onClick={release}
                  disabled={releasing}
                  title="Forget that these were typed by hand, so the next sync can overwrite them from the sheet"
                  className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition hover:bg-surface hover:text-foreground disabled:opacity-60"
                >
                  {releasing ? "Releasing…" : "Release to sheet"}
                </button>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-line px-4 py-2 text-sm font-medium transition hover:bg-surface"
              >
                Cancel
              </button>
              <Save />
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function Save() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save details"}
    </button>
  );
}

function FieldInput({
  field,
  value,
  overridden,
  autoFocus,
}: {
  field: EditableFieldDef;
  value: string | null | undefined;
  overridden: boolean;
  autoFocus?: boolean;
}) {
  const id = `edit-${field.column}`;
  const blank = field.importance !== "optional" && isBlank(value);
  const inputClass = `${FIELD} ${blank ? FIELD_MISSING : ""}`;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="flex flex-wrap items-center gap-2 text-sm font-medium">
        {field.label}
        {field.importance === "required" ? <span className="text-red-600">*</span> : null}
        {blank ? (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-normal text-amber-800 ring-1 ring-inset ring-amber-200">
            {field.importance === "required"
              ? "blocks certificate"
              : field.importance === "email"
                ? "blocks email"
                : "missing"}
          </span>
        ) : overridden ? (
          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-normal text-brand ring-1 ring-inset ring-line">
            edited by hand
          </span>
        ) : null}
      </label>

      {field.type === "textarea" ? (
        <textarea
          id={id}
          name={field.column}
          rows={2}
          defaultValue={value ?? ""}
          placeholder={field.placeholder}
          className={inputClass}
        />
      ) : (
        <input
          id={id}
          name={field.column}
          type={field.type}
          defaultValue={value ?? ""}
          placeholder={field.placeholder}
          autoFocus={autoFocus}
          className={inputClass}
        />
      )}

      {field.hint ? <p className="text-xs text-muted">{field.hint}</p> : null}
    </div>
  );
}
