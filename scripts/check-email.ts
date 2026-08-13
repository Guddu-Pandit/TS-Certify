/**
 * Proves the Gmail App Password works, on its own.
 *
 *   npm run check:email                 -> sends to GMAIL_USER (yourself)
 *   npm run check:email you@example.com -> sends to a specific address
 *
 * Touches no database, no certificates and no storage — so if this works, any
 * later failure is in the certificate pipeline rather than in SMTP, and vice
 * versa. Run it first whenever email misbehaves.
 */
import "dotenv/config";
import { mailTransport, explainMailError } from "../src/lib/email/transport";

async function main() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    console.error(
      "GMAIL_USER and GMAIL_APP_PASSWORD are not set in .env.\n\n" +
        "  1. Google Account -> Security -> turn ON 2-Step Verification\n" +
        "     (App Passwords do not exist as an option without it)\n" +
        "  2. Security -> App passwords -> app 'Mail', name it 'ts-certify'\n" +
        "  3. Copy the 16 characters and REMOVE THE SPACES\n" +
        "  4. Put them in .env as GMAIL_APP_PASSWORD\n",
    );
    process.exit(1);
  }

  const to = process.argv[2] ?? user;
  const transporter = mailTransport();

  console.log(`Authenticating as ${user} ...`);
  await transporter.verify();
  console.log("SMTP login accepted.\n");

  console.log(`Sending a test message to ${to} ...`);
  const info = await transporter.sendMail({
    from: `"${process.env.ORG_NAME ?? "TS Certify"}" <${user}>`,
    to,
    subject: "TS-Certify test message",
    text:
      "This is a test from TS-Certify.\n\n" +
      "If you are reading this, the Gmail App Password is working and certificate emails will send.",
    html:
      "<p>This is a test from <strong>TS-Certify</strong>.</p>" +
      "<p>If you are reading this, the Gmail App Password is working and certificate emails will send.</p>",
  });

  console.log(`Sent. Message id: ${info.messageId}`);
  console.log(`\nCheck the inbox of ${to}, and your Gmail Sent folder.`);
  transporter.close();
}

main().catch((err) => {
  console.error("\n" + explainMailError(err));
  process.exit(1);
});
