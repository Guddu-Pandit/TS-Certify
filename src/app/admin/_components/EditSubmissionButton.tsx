"use client";

import { useState } from "react";
import { missingFields } from "@/config/editable-fields";
import { EditSubmissionDialog, type EditableSubmission } from "./EditSubmissionDialog";

/**
 * Opens the edit dialog from a Server Component page. The page stays server-
 * rendered; only this button and the dialog ship to the browser.
 */
export function EditSubmissionButton({ submission }: { submission: EditableSubmission }) {
  const [open, setOpen] = useState(false);
  const gaps = missingFields(submission);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          gaps.length > 0
            ? "rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
            : "rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium transition hover:bg-brand-soft hover:text-brand"
        }
      >
        {gaps.length > 0 ? `Complete ${gaps.length} missing field${gaps.length === 1 ? "" : "s"}` : "Edit details"}
      </button>

      {open ? (
        <EditSubmissionDialog submission={submission} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}
