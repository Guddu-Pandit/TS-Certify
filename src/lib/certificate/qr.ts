import QRCode from "qrcode";
import { TEMPLATE } from "@/config/template";
import { siteUrl } from "@/config/env";

/** The URL a scanned certificate opens. Also shown as a link in the admin table. */
export function verifyUrl(certificateId: string): string {
  return `${siteUrl}/verify/${encodeURIComponent(certificateId)}`;
}

/**
 * QR code for a certificate, as a PNG buffer ready to composite.
 *
 * Encodes the verification URL rather than the student's details, so:
 *   - the certificate cannot be forged by printing your own QR
 *   - revoking works, because the code resolves live against the database
 *   - a re-render keeps the same code, since it points at the id not the file
 *
 * Error correction level M tolerates roughly 15% damage, which covers the
 * scuffing a printed certificate picks up while still keeping the code small
 * enough to stay crisp at 340px.
 */
export async function certificateQr(certificateId: string): Promise<Buffer> {
  return QRCode.toBuffer(verifyUrl(certificateId), {
    type: "png",
    errorCorrectionLevel: "M",
    margin: TEMPLATE.qr.margin,
    width: TEMPLATE.qr.size,
    color: { dark: TEMPLATE.qr.dark, light: TEMPLATE.qr.light },
  });
}
