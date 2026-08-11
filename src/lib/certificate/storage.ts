import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { CERTIFICATES_BUCKET } from "@/lib/supabase/types";
import { certificatePaths, type CertificatePaths } from "./paths";

export type { CertificatePaths };

/**
 * Uploads a certificate's PNG and PDF to the private `certificates` bucket at
 *
 *   {year}/{domain-slug}/{certificate_id}.{png,pdf}
 *
 * Re-generation overwrites in place (upsert), because the path is derived from
 * the certificate id — which stays the same across re-renders, so that the QR
 * code printed on already-distributed copies keeps working.
 */
export async function uploadCertificate(args: {
  certificateId: string;
  domain: string | null;
  issuedOn: string | Date;
  png: Buffer;
  pdf: Buffer;
}): Promise<CertificatePaths> {
  const paths = certificatePaths({
    certificateId: args.certificateId,
    domain: args.domain,
    issuedOn: args.issuedOn,
  });

  const storage = supabaseAdmin().storage.from(CERTIFICATES_BUCKET);

  const uploads = [
    storage.upload(paths.pdf, args.pdf, {
      contentType: "application/pdf",
      upsert: true,
      // Short cache: a re-generated certificate reuses this exact path, and a
      // long-lived CDN copy would keep serving the superseded version.
      cacheControl: "60",
    }),
    storage.upload(paths.png, args.png, {
      contentType: "image/png",
      upsert: true,
      cacheControl: "60",
    }),
  ];

  for (const result of await Promise.all(uploads)) {
    if (result.error) {
      const msg = result.error.message;
      if (/bucket not found/i.test(msg)) {
        throw new Error(
          `Storage bucket "${CERTIFICATES_BUCKET}" does not exist. Create it in Supabase → Storage, with the Public toggle OFF.`,
        );
      }
      throw new Error(`Upload failed: ${msg}`);
    }
  }

  return paths;
}

/**
 * Time-limited URL for a stored file.
 *
 * The bucket is private, so this is the only way to hand a file to a browser.
 * Minted fresh per click rather than embedded in a page, so a URL never
 * outlives the session that produced it.
 */
export async function signedUrl(path: string, expiresInSeconds = 3600): Promise<string> {
  const { data, error } = await supabaseAdmin()
    .storage.from(CERTIFICATES_BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data) throw new Error(`Could not sign ${path}: ${error?.message ?? "unknown error"}`);
  return data.signedUrl;
}

/** Downloads a stored file into memory — used to attach the PDF to an email. */
export async function downloadCertificate(path: string): Promise<Buffer> {
  const { data, error } = await supabaseAdmin()
    .storage.from(CERTIFICATES_BUCKET)
    .download(path);

  if (error || !data) throw new Error(`Could not read ${path}: ${error?.message ?? "not found"}`);
  return Buffer.from(await data.arrayBuffer());
}
