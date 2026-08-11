import { parseSheetDate, parseSheetDateTime } from "@/lib/dates";

/**
 * ============================================================================
 *  THE ONE FILE TO EDIT WHEN YOUR GOOGLE FORM CHANGES
 * ============================================================================
 *
 * Maps Google Sheet column headers onto database columns.
 *
 * Headers are normalised before matching — lowercased, punctuation stripped,
 * and anything in parentheses removed — so "Full Name (as on certificate)"
 * still matches the alias "full name". Add whatever wording your form actually
 * uses to the `headers` array; order does not matter.
 *
 * ---------------------------------------------------------------------------
 * ADDING A NEW FIELD LATER — two steps:
 *
 *   1. In Supabase SQL Editor:
 *        alter table public.submissions add column college_year text;
 *   2. Add an entry below:
 *        { column: "college_year", headers: ["year of study", "current year"] }
 *
 * Nothing is lost in the meantime: any header not claimed here is captured
 * automatically into `submissions.extra`, and the whole row always lands in
 * `submissions.raw`. So you can backfill the new column afterwards with:
 *
 *   update public.submissions
 *   set college_year = extra->>'Year of Study'
 *   where extra ? 'Year of Study';
 * ---------------------------------------------------------------------------
 */

export interface FieldDef {
  /** Column on public.submissions. */
  column: string;
  /** Accepted header wordings. Matched after normalisation. */
  headers: string[];
  /** Sync reports an error for any row where this is blank. */
  required?: boolean;
  /** Cell text -> value stored in the database. */
  transform?: (raw: string) => unknown;
  /** Shown in the mapping diagnostics. */
  note?: string;
}

/** "Full Name (as on certificate)" -> "full name" */
export function normaliseHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/\(.*?\)/g, " ") // drop parenthetical hints
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const text = (v: string) => (v.trim() === "" ? null : v.trim());

export const FIELD_MAP: FieldDef[] = [
  {
    column: "submitted_at",
    headers: ["timestamp", "submission time", "date submitted"],
    transform: parseSheetDateTime,
    note: "Google Forms adds this automatically. Also half of the duplicate-detection key.",
  },
  {
    column: "full_name",
    headers: [
      "full name",
      "name",
      "student name",
      "name of the student",
      "your name",
      "candidate name",
      "name as on certificate",
    ],
    required: true,
    transform: (v) => v.trim().replace(/\s+/g, " "),
    note: "Printed on the certificate.",
  },
  {
    column: "email",
    headers: ["email", "email address", "email id", "e mail", "your email", "email id "],
    transform: (v) => (v.trim() === "" ? null : v.trim().toLowerCase()),
    note: "Where the certificate is sent. Also half of the duplicate-detection key.",
  },
  {
    column: "phone",
    headers: ["phone", "phone number", "mobile", "mobile number", "contact number", "whatsapp number"],
    transform: text,
  },
  {
    column: "domain",
    headers: [
      "domain",
      "internship domain",
      "course",
      "track",
      "field",
      "domain of internship",
      "internship field",
      "select your domain",
    ],
    transform: text,
    note: "Printed on the certificate, and used as the storage folder name.",
  },
  {
    column: "institution",
    headers: [
      "school college",
      "college",
      "school",
      "institution",
      "university",
      "college name",
      "school name",
      "college university",
      "name of your college",
      "institute",
    ],
    transform: text,
  },
  {
    column: "start_date",
    headers: ["start date", "internship start date", "from date", "starting date", "from"],
    transform: parseSheetDate,
    note: "Together with end date, produces the printed duration.",
  },
  {
    column: "end_date",
    headers: ["end date", "internship end date", "to date", "ending date", "completion date", "to"],
    transform: parseSheetDate,
  },
];

/**
 * Headers that are known to be uninteresting. Kept out of `extra` so the
 * "unmapped columns" warning stays meaningful. Still preserved in `raw`.
 */
export const IGNORED_HEADERS = [
  "score", // added when the form is a quiz
  "username",
].map(normaliseHeader);
