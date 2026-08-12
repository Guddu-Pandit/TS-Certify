import { differenceInCalendarDays, format, isValid, parse } from "date-fns";

/**
 * Date handling for sheet input and certificate/UI output.
 *
 * Google Sheets returns dates as locale-formatted strings. In India that is
 * dd/MM/yyyy, which `new Date("03/04/2026")` silently misreads as March 4th
 * instead of April 3rd — a whole class of wrong certificates. So parsing here
 * is always explicit about the format, and unparseable values return null so
 * the caller can report them rather than storing a wrong date.
 */

/** Formats accepted from the sheet, most specific first. */
const SHEET_DATE_FORMATS = [
  "dd/MM/yyyy",
  "d/M/yyyy",
  "dd-MM-yyyy",
  "d-M-yyyy",
  "yyyy-MM-dd", // ISO, and what Sheets sends when the column is a real date
  "dd MMM yyyy",
  "d MMM yyyy",
  "MMMM d, yyyy",
  "d MMMM yyyy",
];

const SHEET_DATETIME_FORMATS = [
  "dd/MM/yyyy HH:mm:ss",
  "d/M/yyyy HH:mm:ss",
  "dd/MM/yyyy HH:mm",
  "d/M/yyyy H:mm:ss",
  "yyyy-MM-dd HH:mm:ss",
  "M/d/yyyy HH:mm:ss",
];

/**
 * Sheets serial numbers: days since 1899-12-30. Returned when the API is
 * asked for UNFORMATTED_VALUE on a real date cell.
 */
function fromSheetSerial(serial: number): Date | null {
  if (!Number.isFinite(serial) || serial <= 0 || serial > 100_000) return null;
  const ms = Math.round(serial * 86_400_000);
  const d = new Date(Date.UTC(1899, 11, 30) + ms);
  return isValid(d) ? d : null;
}

function tryFormats(value: string, formats: string[]): Date | null {
  for (const f of formats) {
    const parsed = parse(value, f, new Date());
    if (isValid(parsed)) return parsed;
  }
  return null;
}

/** Sheet cell -> `yyyy-MM-dd` for a Postgres `date` column, or null. */
export function parseSheetDate(value: unknown): string | null {
  if (value == null || value === "") return null;

  if (typeof value === "number") {
    const d = fromSheetSerial(value);
    return d ? format(d, "yyyy-MM-dd") : null;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  // A bare number arriving as text is still a serial.
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const d = fromSheetSerial(Number(raw));
    if (d) return format(d, "yyyy-MM-dd");
  }

  const parsed = tryFormats(raw, SHEET_DATE_FORMATS);
  return parsed ? format(parsed, "yyyy-MM-dd") : null;
}

/** The form's Timestamp column -> ISO string for `timestamptz`, or null. */
export function parseSheetDateTime(value: unknown): string | null {
  if (value == null || value === "") return null;

  if (typeof value === "number") {
    const d = fromSheetSerial(value);
    return d ? d.toISOString() : null;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const withTime = tryFormats(raw, SHEET_DATETIME_FORMATS);
  if (withTime) return withTime.toISOString();

  // Fall back to a date-only value at midnight.
  const dateOnly = parseSheetDate(raw);
  return dateOnly ? new Date(`${dateOnly}T00:00:00Z`).toISOString() : null;
}

/** `2026-06-30` -> `30 Jun 2026`. Blank input renders as an em dash. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return isValid(d) ? format(d, "dd MMM yyyy") : "—";
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return isValid(d) ? format(d, "dd MMM yyyy, HH:mm") : "—";
}

/**
 * Human duration between two dates.
 *
 * The single place this wording is decided — it appears on the certificate and
 * in the email, so changing the phrasing here changes it everywhere at once.
 * Both endpoints count as worked days, hence the +1.
 */
export function durationLabel(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined,
): string {
  if (!start || !end) return "—";

  const s = typeof start === "string" ? new Date(start) : start;
  const e = typeof end === "string" ? new Date(end) : end;
  if (!isValid(s) || !isValid(e)) return "—";

  const days = differenceInCalendarDays(e, s) + 1;
  if (days <= 0) return "—";
  if (days < 14) return `${days} Day${days === 1 ? "" : "s"}`;

  const weeks = Math.round(days / 7);
  if (days < 60) return `${weeks} Week${weeks === 1 ? "" : "s"}`;

  const months = Math.round(days / 30);
  return `${months} Month${months === 1 ? "" : "s"}`;
}

/** What the certificate and email print: "8 Weeks (12 Jan 2026 to 09 Mar 2026)". */
export function durationSentence(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined,
): string {
  const label = durationLabel(start, end);
  if (label === "—") return "—";
  return `${label} (${formatDate(start)} to ${formatDate(end)})`;
}

/** "3 minutes ago" style, for the "last synced" indicator. */
export function relativeTime(value: string | Date | null | undefined): string {
  if (!value) return "never";
  const d = typeof value === "string" ? new Date(value) : value;
  if (!isValid(d)) return "never";

  const seconds = Math.round((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatDate(d);
}
