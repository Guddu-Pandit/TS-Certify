import { PDFDocument } from "pdf-lib";
import { TEMPLATE } from "@/config/template";

/**
 * Wraps the rendered PNG in a single-page PDF.
 *
 * The PDF is what gets emailed — it prints predictably and reads as an
 * official document, where a bare PNG attachment does not. Using pdf-lib as a
 * pure container means one drawing pass produces both outputs: the PNG for
 * on-screen preview, the PDF for delivery.
 *
 * Page size is the image scaled to A4 landscape points (1pt = 1/72"), so the
 * result prints at the intended physical size rather than at 300dpi's
 * nominal 3508pt width.
 */
export async function pngToPdf(png: Buffer): Promise<Buffer> {
  const pdf = await PDFDocument.create();

  const image = await pdf.embedPng(png);

  // 300dpi source -> 72dpi points.
  const scale = 72 / 300;
  const width = TEMPLATE.width * scale;
  const height = TEMPLATE.height * scale;

  const page = pdf.addPage([width, height]);
  page.drawImage(image, { x: 0, y: 0, width, height });

  pdf.setTitle("Certificate of Completion");
  pdf.setProducer("TS-Certify");
  pdf.setCreator("TS-Certify");

  return Buffer.from(await pdf.save());
}
