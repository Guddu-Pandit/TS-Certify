/**
 * ============================================================================
 *  WHICH SUBMISSION FIELDS A HUMAN MAY FILL IN BY HAND
 * ============================================================================
 *
 * The Google Form is the source of truth, but it is not a complete one — a
 * student skips the end date, mistypes an email, or the form never asked for
 * their college at all. Those rows land incomplete and cannot be issued.
 *
 * This list is what /admin's edit dialog renders, AND the allow-list the
 * server action and the sync both filter against, so a crafted request can
 * only ever touch these columns. Adding a field here is the only step needed
 * to make it editable — provided the column exists on `public.submissions`.
 *
 * Deliberately client-safe (no `server-only`, no env): the dialog is a client
 * component and imports the same definitions the action validates against.
 *
 * `importance` drives what counts as "missing":
 *   required     — no certificate can be generated while this is blank
 *                  (mirrors requiredFieldProblems() in lib/certificate/generate.ts)
 *   email        — the certificate can be made, but never delivered
 *   recommended  — printed or useful, but nothing breaks without it
 *   optional     — internal only; never reported as missing
 */

export type EditableColumn =
  | "full_name"
  | "email"
  | "phone"
  | "domain"
  | "institution"
  | "start_date"
  | "end_date"
  | "notes";

export type FieldImportance = "required" | "email" | "recommended" | "optional";

export interface EditableFieldDef {
  column: EditableColumn;
  label: string;
  type: "text" | "email" | "tel" | "date" | "textarea";
  importance: FieldImportance;
  placeholder?: string;
  /** Shown under the input in the dialog. */
  hint?: string;
}

export const EDITABLE_FIELDS: EditableFieldDef[] = [
  {
    column: "full_name",
    label: "Full name",
    type: "text",
    importance: "required",
    placeholder: "Asha Rao",
    hint: "Printed on the certificate exactly as typed.",
  },
  {
    column: "email",
    label: "Email",
    type: "email",
    importance: "email",
    placeholder: "asha@example.com",
    hint: "Where the certificate is sent.",
  },
  {
    column: "phone",
    label: "Phone",
    type: "tel",
    importance: "recommended",
    placeholder: "+91 98765 43210",
  },
  {
    column: "domain",
    label: "Domain",
    type: "text",
    importance: "required",
    placeholder: "Web Development",
    hint: "Printed on the certificate, and used as the storage folder name.",
  },
  {
    column: "institution",
    label: "School / College",
    type: "text",
    importance: "recommended",
    placeholder: "St. Xavier's College",
  },
  {
    column: "start_date",
    label: "Start date",
    type: "date",
    importance: "required",
  },
  {
    column: "end_date",
    label: "End date",
    type: "date",
    importance: "required",
    hint: "With the start date, this produces the printed duration.",
  },
  {
    column: "notes",
    label: "Internal notes",
    type: "textarea",
    importance: "optional",
    placeholder: "Why this row was edited by hand — future you will want to know.",
  },
];

/** Guards the server action and the sync against writing anything else. */
export const EDITABLE_COLUMNS: readonly EditableColumn[] = EDITABLE_FIELDS.map((f) => f.column);

export function fieldDef(column: string): EditableFieldDef | undefined {
  return EDITABLE_FIELDS.find((f) => f.column === column);
}

/** Blank means null, undefined, or whitespace — a sheet cell can be any of them. */
export function isBlank(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === "";
}

type PartialSubmission = Partial<Record<EditableColumn, unknown>>;

/**
 * Fields the form did not give us. `optional` fields never appear here — an
 * empty notes column is not a gap, it is the normal state.
 */
export function missingFields(row: PartialSubmission): EditableFieldDef[] {
  return EDITABLE_FIELDS.filter((f) => f.importance !== "optional" && isBlank(row[f.column]));
}

/** The subset that actually blocks issuing a certificate. */
export function blockingFields(row: PartialSubmission): EditableFieldDef[] {
  return missingFields(row).filter((f) => f.importance === "required");
}

/** True when a certificate could be generated but not delivered. */
export function missingEmail(row: PartialSubmission): boolean {
  return isBlank(row.email);
}
