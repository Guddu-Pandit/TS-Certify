"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { SubmissionRow } from "@/lib/supabase/types";
import { EDITABLE_FIELDS, type EditableColumn } from "@/config/editable-fields";

export interface EditSubmissionState {
  error: string | null;
  success: string | null;
}

export const EDIT_IDLE: EditSubmissionState = { error: null, success: null };

/**
 * Both admin and hr may edit. Hiding the button is convenience; this is the
 * boundary — a Server Action is a POST endpoint anyone signed in can reach.
 */
async function requireEditor() {
  const user = await getCurrentUser();
  if (!user) return { user: null, denied: "Your session has expired. Sign in again." };
  if (!user.can.editSubmissions) {
    return { user: null, denied: "Your account cannot edit submissions." };
  }
  return { user, denied: null };
}

/** "" -> null, so a cleared input stores NULL rather than an empty string. */
function textOrNull(raw: FormDataEntryValue | null): string | null {
  const value = String(raw ?? "").trim();
  return value === "" ? null : value;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Saves hand-typed values for the fields the Google Form left blank.
 *
 * Every column touched is also recorded in `manual_overrides`, which is what
 * makes the edit permanent: syncFromSheet() re-applies those on top of the
 * sheet, so the next sync cannot put the blank cell back. See
 * supabase/004_manual_edits.sql.
 */
export async function updateSubmission(
  _prev: EditSubmissionState,
  formData: FormData,
): Promise<EditSubmissionState> {
  const { user, denied } = await requireEditor();
  if (denied) return { error: denied, success: null };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "No submission was identified.", success: null };

  const admin = supabaseAdmin();

  // Read the row first: the client sends only the change, never the record.
  const { data: current, error: readError } = await admin
    .from("submissions")
    .select("*")
    .eq("id", id)
    .maybeSingle<SubmissionRow>();

  if (readError) return { error: readError.message, success: null };
  if (!current) return { error: "That submission no longer exists.", success: null };

  // Read every editable field off the form, normalising as we go. Anything not
  // in EDITABLE_FIELDS is ignored outright, so the payload cannot reach
  // another column.
  const values: Partial<Record<EditableColumn, string | null>> = {};

  for (const field of EDITABLE_FIELDS) {
    // A field absent from the payload is left alone rather than nulled — the
    // detail page and the table dialog may render different subsets later.
    if (!formData.has(field.column)) continue;

    let value = textOrNull(formData.get(field.column));

    if (value !== null) {
      if (field.column === "full_name") value = value.replace(/\s+/g, " ");
      if (field.type === "email") value = value.toLowerCase();
      if (field.type === "date" && !ISO_DATE.test(value)) {
        return { error: `${field.label} must be a real date.`, success: null };
      }
    }

    values[field.column] = value;
  }

  if (values.full_name === null) {
    return { error: "Full name cannot be empty — it is printed on the certificate.", success: null };
  }
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    return { error: `"${values.email}" does not look like an email address.`, success: null };
  }

  // Compare against what would be stored, not just what was submitted, so a
  // date supplied by the sheet still guards one typed by hand.
  const start = values.start_date !== undefined ? values.start_date : current.start_date;
  const end = values.end_date !== undefined ? values.end_date : current.end_date;
  if (start && end && end < start) {
    return { error: "The end date is before the start date.", success: null };
  }

  // Only columns that actually changed. Re-saving an untouched dialog should
  // not stamp every field as manually owned — that would freeze the row
  // against the sheet for no reason.
  const changed = (Object.entries(values) as [EditableColumn, string | null][]).filter(
    ([column, value]) => (current[column] ?? null) !== value,
  );

  if (changed.length === 0) {
    return { error: null, success: "Nothing changed." };
  }

  const nextOverrides = {
    ...(current.manual_overrides ?? {}),
    ...Object.fromEntries(changed),
  };

  const { error } = await admin
    .from("submissions")
    .update({
      ...Object.fromEntries(changed),
      manual_overrides: nextOverrides,
      edited_at: new Date().toISOString(),
      edited_by: user!.id,
    })
    .eq("id", id);

  if (error) return { error: error.message, success: null };

  revalidatePath("/admin");
  revalidatePath(`/admin/submissions/${id}`);

  const names = changed.map(([column]) => column.replace(/_/g, " ")).join(", ");
  return { error: null, success: `Saved ${names}. This now survives future syncs.` };
}

/**
 * Hands the row back to the Google Sheet.
 *
 * The stored values stay as they are — this only forgets that a human owns
 * them, so the next sync is free to overwrite them with the sheet's cells.
 * The way out of a typo that has been syncing back for a week.
 */
export async function clearManualOverrides(id: string): Promise<EditSubmissionState> {
  const { denied } = await requireEditor();
  if (denied) return { error: denied, success: null };
  if (!id) return { error: "No submission was identified.", success: null };

  const { error } = await supabaseAdmin()
    .from("submissions")
    .update({ manual_overrides: {}, edited_at: null, edited_by: null })
    .eq("id", id);

  if (error) return { error: error.message, success: null };

  revalidatePath("/admin");
  revalidatePath(`/admin/submissions/${id}`);
  return {
    error: null,
    success: "Manual edits released. The next sync will take these values from the sheet.",
  };
}
