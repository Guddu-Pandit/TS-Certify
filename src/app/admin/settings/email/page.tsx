import { requireUser } from "@/lib/auth";
import { appEnv } from "@/config/env";
import { siteUrl } from "@/config/env";
import { loadEmailTemplate, PLACEHOLDERS } from "@/lib/email/template";
import { formatDate } from "@/lib/dates";
import { EmailTemplateEditor } from "./EmailTemplateEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Email template · TS-Certify" };

export default async function EmailSettingsPage() {
  await requireUser();

  const template = await loadEmailTemplate();
  const { ORG_NAME } = appEnv();
  const gmailUser = process.env.GMAIL_USER?.trim();

  // Fixed sample so the preview is stable while typing.
  const sample: Record<string, string> = {
    name: "Aarav Sharma",
    firstName: "Aarav",
    domain: "Web Development",
    duration: "8 Weeks (12 Jan 2026 to 09 Mar 2026)",
    startDate: "12 Jan 2026",
    endDate: "09 Mar 2026",
    institution: "Delhi Technological University",
    certificateId: "TS-2026-0001",
    verifyUrl: `${siteUrl}/verify/TS-2026-0001`,
    issuedOn: formatDate(new Date()),
    orgName: ORG_NAME,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Certificate email</h1>
        <p className="mt-1 text-sm text-muted">
          Edit the message students receive with their certificate. Saved to the database, so
          changes take effect immediately — no redeploy.
        </p>
      </div>

      {gmailUser ? (
        <p className="rounded-lg border border-line bg-surface px-4 py-2.5 text-sm">
          Sending as <span className="font-medium">{ORG_NAME}</span>{" "}
          <span className="font-mono text-xs text-muted">&lt;{gmailUser}&gt;</span>
        </p>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Gmail is not configured yet</p>
          <p className="mt-1">
            You can write and save the template now, but sending will fail until{" "}
            <code className="font-mono text-xs">GMAIL_USER</code> and{" "}
            <code className="font-mono text-xs">GMAIL_APP_PASSWORD</code> are set in{" "}
            <code className="font-mono text-xs">.env</code>.
          </p>
          <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-xs">
            <li>Google Account → Security → turn on 2-Step Verification (required first)</li>
            <li>Security → App passwords → app &ldquo;Mail&rdquo;, name it &ldquo;ts-certify&rdquo;</li>
            <li>Copy the 16 characters, remove the spaces, put them in .env</li>
            <li>
              Run <code className="font-mono">npm run check:email</code> to confirm before sending
              to anyone real
            </li>
          </ol>
        </div>
      )}

      <EmailTemplateEditor
        initial={{
          subject: template.subject,
          body_html: template.body_html,
          body_text: template.body_text,
          attachment_name: template.attachment_name,
        }}
        placeholders={[...PLACEHOLDERS]}
        sample={sample}
      />
    </div>
  );
}
