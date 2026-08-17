import QRCode from "qrcode";
import { DEFAULT_LAYOUT, type QrBox } from "@/config/template";
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
 * scuffing a printed certificate picks up while still keeping the code crisp
 * at the sizes the layout editor allows.
 *
 * `box` comes from the active layout, so resizing or recolouring the QR in the
 * editor changes the code that is generated, not just how it is scaled.
 */
export async function certificateQr(
  certificateId: string,
  box: QrBox = DEFAULT_LAYOUT.qr,
): Promise<Buffer> {
  return QRCode.toBuffer(verifyUrl(certificateId), {
    type: "png",
    errorCorrectionLevel: "M",
    margin: box.margin,
    width: box.size,
    color: { dark: box.dark, light: box.light },
  });
}
