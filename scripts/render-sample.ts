/**
 * Renders sample certificates to ./sample/ using fake data.
 *
 *   npm run render:sample
 *
 * No database, no server, no auth — just the renderer. This is the loop to use
 * when positioning fields on a new template: edit src/config/template.ts, run
 * this, look at the PNG, repeat. It takes about a second.
 *
 * Three samples are produced deliberately:
 *   1-normal    a typical name
 *   2-long      a very long name, to prove it shrinks/wraps instead of
 *               spilling over the border art
 *   3-short     a short name, to check it does not look lost
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { renderCertificate, type CertificateData } from "../src/lib/certificate/render";
import { pngToPdf } from "../src/lib/certificate/to-pdf";
import { verifyUrl } from "../src/lib/certificate/qr";

const SAMPLES: { label: string; data: CertificateData }[] = [
  {
    label: "1-normal",
    data: {
      certificateId: "TS-2026-0001",
      fullName: "Aarav Sharma",
      domain: "Web Development",
      institution: "Delhi Technological University",
      startDate: "2026-01-12",
      endDate: "2026-03-09",
      issuedOn: new Date(),
    },
  },
  {
    label: "2-long",
    data: {
      certificateId: "TS-2026-0002",
      fullName: "Lakshminarayanan Balasubramaniam Venkataraghavan",
      domain: "Artificial Intelligence and Machine Learning",
      institution: "Indian Institute of Information Technology, Allahabad",
      startDate: "2026-01-05",
      endDate: "2026-06-30",
      issuedOn: new Date(),
    },
  },
  {
    label: "3-short",
    data: {
      certificateId: "TS-2026-0003",
      fullName: "Ravi K",
      domain: "UI/UX",
      institution: "NIT Trichy",
      startDate: "2026-02-01",
      endDate: "2026-02-28",
      issuedOn: new Date(),
    },
  },
];

async function main() {
  const outDir = path.join(process.cwd(), "sample");
  fs.mkdirSync(outDir, { recursive: true });

  for (const { label, data } of SAMPLES) {
    // Sequential on purpose: each canvas is a ~35MB bitmap.
    const { png, adjustedFields } = await renderCertificate(data);
    const pdf = await pngToPdf(png);

    fs.writeFileSync(path.join(outDir, `${label}.png`), png);
    fs.writeFileSync(path.join(outDir, `${label}.pdf`), pdf);

    const note = adjustedFields.length ? `  (auto-fitted: ${adjustedFields.join(", ")})` : "";
    console.log(`${label.padEnd(10)} ${data.fullName}${note}`);
    console.log(`${"".padEnd(10)} QR -> ${verifyUrl(data.certificateId)}`);
  }

  console.log(`\nWrote ${SAMPLES.length * 2} files to ./sample/`);
  console.log("Open the PNGs, adjust src/config/template.ts, run again.");
}

main().catch((err) => {
  console.error("\n" + (err instanceof Error ? err.message : String(err)));
  process.exit(1);
});
