/**
 * Object paths inside the private `certificates` storage bucket.
 *
 * Layout:  {year}/{domain-slug}/{certificate_id}.{pdf|png}
 * Example: 2026/web-development/TS-2026-0001.pdf
 *
 * The filename is the certificate id, which is also what the QR code encodes
 * and what `certificates.certificate_id` stores — so a scanned code, the DB
 * row, and the stored file all line up without a lookup table.
 */

// The combining-diacritics block. Built with the RegExp constructor from an
// escaped string rather than a literal, so the pattern cannot be corrupted by
// an editor re-encoding this file.
const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

/** Domain -> URL-safe folder name. "Web Development" -> "web-development". */
export function slugifyDomain(domain: string | null | undefined): string {
  const slug = (domain ?? "")
    // Decompose first, then drop the marks, so "Économie" folds to "economie"
    // rather than splitting into "e-conomie".
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  // A submission can reach generation with a blank domain; it still needs a
  // folder, and an empty path segment would produce a "//" in the object key.
  return slug || "unspecified";
}

/** The year folder, taken from the issue date. */
export function certificateYear(issuedOn: Date | string = new Date()): string {
  const d = typeof issuedOn === "string" ? new Date(issuedOn) : issuedOn;
  return String(d.getFullYear());
}

export interface CertificatePaths {
  pdf: string;
  png: string;
  /** The folder both files live in, useful for listing or bulk download. */
  folder: string;
}

export function certificatePaths(args: {
  certificateId: string;
  domain: string | null | undefined;
  issuedOn?: Date | string;
}): CertificatePaths {
  const folder = `${certificateYear(args.issuedOn)}/${slugifyDomain(args.domain)}`;
  return {
    folder,
    pdf: `${folder}/${args.certificateId}.pdf`,
    png: `${folder}/${args.certificateId}.png`,
  };
}
