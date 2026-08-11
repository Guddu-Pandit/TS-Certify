import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { loadEmailTemplate, placeholderValues, renderEmail } from "../src/lib/email/template";
import { sendCertificateEmails } from "../src/lib/email/send";
import type { CertificateRow } from "../src/lib/supabase/types";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

async function main() {
  const { data: cert } = await admin
    .from("certificates")
    .select("*")
    .eq("certificate_id", "TS-2026-0001")
    .single<CertificateRow>();

  const template = await loadEmailTemplate();
  const values = placeholderValues(cert);
  const email = renderEmail(template, values);

  console.log("=== SUBSTITUTION ===");
  console.log("subject   :", email.subject);
  console.log("attachment:", email.attachmentName);
  console.log("\ntext body:");
  console.log(
    email.text
      .split("\n")
      .map((l) => "  " + l)
      .join("\n"),
  );

  console.log("\n=== CHECKS ===");
  const leftovers = [email.subject, email.text, email.html].join("").match(/\{\{\w+\}\}/g);
  console.log(leftovers ? `  FAIL  unsubstituted: ${leftovers.join(", ")}` : "  PASS  every placeholder replaced");
  console.log(email.text.includes(cert.full_name) ? "  PASS  name present" : "  FAIL  name missing");
  console.log(email.subject.includes(cert.domain!) ? "  PASS  domain in subject" : "  FAIL  domain missing");
  console.log(email.text.includes("8 Weeks") ? "  PASS  duration present" : "  FAIL  duration missing");
  console.log(email.text.includes("/verify/TS-2026-0001") ? "  PASS  verify link present" : "  FAIL  verify link missing");
  console.log(email.attachmentName.endsWith(".pdf") ? "  PASS  attachment ends .pdf" : "  FAIL  bad attachment name");
  console.log(!/[\\/:*?"<>|]/.test(email.attachmentName) ? "  PASS  filename has no illegal chars" : "  FAIL  illegal chars in filename");

  // A domain containing a slash must not produce an unopenable attachment.
  const slashy = renderEmail(template, { ...values, domain: "AI/ML", name: "Test: User" });
  console.log(
    !/[\\/:*?"<>|]/.test(slashy.attachmentName)
      ? `  PASS  "AI/ML" sanitised -> ${slashy.attachmentName}`
      : `  FAIL  ${slashy.attachmentName}`,
  );

  console.log("\n=== SEND WITHOUT GMAIL CONFIGURED ===");
  const result = await sendCertificateEmails(["TS-2026-0001"]);
  const r = result.results[0];
  console.log(`  status: ${r.status}`);
  console.log(`  message: ${r.message?.slice(0, 160)}`);
  console.log(
    r.status === "failed" && /App Password|2-Step|Gmail/i.test(r.message ?? "")
      ? "  PASS  fails with actionable guidance, no crash"
      : "  FAIL  unhelpful failure",
  );

  const { count } = await admin.from("email_log").select("*", { count: "exact", head: true });
  console.log(`\n  email_log rows: ${count} (a pre-flight config failure is not logged per row)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
