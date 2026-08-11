import "server-only";

import { google } from "googleapis";
import { googleEnv } from "@/config/env";

/**
 * Read-only Google Sheets client authenticated as a service account.
 *
 * Access to the spreadsheet comes from SHARING it with the service account's
 * email address, not from any IAM role. If this 403s with valid credentials,
 * that share step is what is missing.
 */
export function sheetsClient() {
  const env = googleEnv();

  const auth = new google.auth.JWT({
    email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: env.GOOGLE_PRIVATE_KEY,
    // Read-only: this app must never be able to modify the responses.
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  return {
    sheets: google.sheets({ version: "v4", auth }),
    spreadsheetId: env.GOOGLE_SHEET_ID,
    tab: env.GOOGLE_SHEET_TAB,
    serviceAccountEmail: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  };
}

/**
 * Turns Google's API errors into something that says what to actually do.
 * These three account for nearly every failure in practice.
 */
export function explainSheetsError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const status = (err as { code?: number; status?: number })?.code ?? (err as { status?: number })?.status;

  if (status === 403 || /permission|forbidden/i.test(message)) {
    return "Google refused access to the sheet. Open the Form's response Sheet → Share → add the service account email as a Viewer. IAM roles do not grant Sheets access.";
  }
  if (status === 404 || /not found|Requested entity/i.test(message)) {
    return "Sheet not found. Check GOOGLE_SHEET_ID — it is the part of the URL between /spreadsheets/d/ and /edit.";
  }
  if (/Unable to parse range/i.test(message)) {
    return "The tab name does not exist in that spreadsheet. Check GOOGLE_SHEET_TAB — it is the tab label at the bottom, usually 'Form Responses 1'.";
  }
  if (/DECODER routines|unsupported|invalid_grant/i.test(message)) {
    return "The service account private key could not be read. In .env it must be one line in double quotes with literal \\n sequences, copied whole from the JSON key file.";
  }
  return message;
}
