import "server-only";

import nodemailer, { type Transporter } from "nodemailer";
import { gmailEnv } from "@/config/env";

let cached: Transporter | null = null;

/**
 * Gmail SMTP transport, as a pooled singleton.
 *
 * Pooling with a single connection and a rate limit is deliberate: opening 50
 * parallel connections to send a cohort's certificates is exactly what gets an
 * account temporarily blocked by Gmail. One connection sending ~3 messages a
 * second is well inside the limits and still finishes a batch of 30 in ten
 * seconds.
 */
export function mailTransport(): Transporter {
  if (cached) return cached;

  const env = gmailEnv();

  cached = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: env.GMAIL_USER, pass: env.GMAIL_APP_PASSWORD },
    pool: true,
    maxConnections: 1,
    rateDelta: 1000,
    rateLimit: 3,
  });

  return cached;
}

/** Turns SMTP failures into something that says what to fix. */
export function explainMailError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);

  if (/Username and Password not accepted|BadCredentials|535/i.test(message)) {
    return (
      "Gmail rejected the credentials. Two things to check: 2-Step Verification must be ON for the account, " +
      "and GMAIL_APP_PASSWORD must be the 16-character App Password with the spaces removed — not your normal Gmail password."
    );
  }
  if (/Daily user sending (quota|limit) exceeded|550.*quota/i.test(message)) {
    return "Gmail's daily sending limit has been reached (about 500 messages). Wait 24 hours, or move to a dedicated sending service.";
  }
  if (/ETIMEDOUT|ECONNREFUSED|ENOTFOUND|ECONNRESET/i.test(message)) {
    return "Could not reach smtp.gmail.com. Check the network connection or firewall.";
  }
  if (/Invalid login|Application-specific password required/i.test(message)) {
    return "Gmail requires an App Password for this account. Create one at Google Account → Security → App passwords.";
  }
  return message;
}
