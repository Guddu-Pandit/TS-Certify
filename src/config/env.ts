import { z } from "zod";

/**
 * Validated environment access.
 *
 * Deliberately split per integration rather than one big schema. A single
 * all-or-nothing check means the Supabase-backed pages refuse to load until
 * Google and Gmail credentials are also filled in — which is wrong, because
 * those features are independent and get configured at different times.
 *
 * Each group below is parsed lazily, on first use, so a missing Gmail password
 * breaks exactly one thing: sending email. And it breaks it with a message
 * naming the variable, at the moment you click the button.
 */

/** Treat "" the same as unset — a blank line in .env is not a value. */
const optionalText = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().min(1).optional(),
);

function parse<T extends z.ZodTypeAny>(
  schema: T,
  source: Record<string, unknown>,
  what: string,
  hint: string,
): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`${what} is not configured:\n${details}\n\n${hint}`);
  }
  return result.data;
}

function assertServer(fn: string) {
  if (typeof window !== "undefined") {
    throw new Error(`${fn} was called in the browser — this would leak secrets.`);
  }
}

/** Caches so each group is validated once per process, not per request. */
const cache = new Map<string, unknown>();
function once<T>(key: string, build: () => T): T {
  if (!cache.has(key)) cache.set(key, build());
  return cache.get(key) as T;
}

// ---------------------------------------------------------------------------
// Public — inlined into the browser bundle. Assume the world can read these.
// ---------------------------------------------------------------------------
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("must be the full https://... project URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_SITE_URL: z
    .string()
    .url("must include the protocol, e.g. http://localhost:3000")
    // A trailing slash would produce `https://site.com//verify/...` in QR codes.
    .transform((v) => v.replace(/\/+$/, "")),
});

export const publicEnv = parse(
  publicSchema,
  {
    // Referenced as full literals, not process.env[key], or Next.js cannot
    // substitute them into the client bundle at build time.
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  },
  "Supabase / site URL",
  "Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and NEXT_PUBLIC_SITE_URL in .env.",
);

/** The origin QR codes and verification links are built from. */
export const siteUrl = publicEnv.NEXT_PUBLIC_SITE_URL;

// ---------------------------------------------------------------------------
// Supabase service role — needed by every admin page.
// ---------------------------------------------------------------------------
export function supabaseEnv() {
  assertServer("supabaseEnv()");
  return once("supabase", () =>
    parse(
      z.object({ SUPABASE_SERVICE_ROLE_KEY: z.string().min(20) }),
      process.env,
      "Supabase service role",
      "Copy the service_role key from Supabase → Project Settings → API into .env.",
    ),
  );
}

// ---------------------------------------------------------------------------
// Google Sheets — needed only by the sync.
// ---------------------------------------------------------------------------
export function googleEnv() {
  assertServer("googleEnv()");
  return once("google", () =>
    parse(
      z.object({
        GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().email("should end in .iam.gserviceaccount.com"),
        // The JSON key's private_key holds real newlines. Stored in .env as a
        // single quoted line with literal \n, so unescape it here. On Vercel
        // the value is pasted with real newlines and this replace is a no-op.
        GOOGLE_PRIVATE_KEY: z
          .string()
          .min(1)
          .transform((v) => v.replace(/\\n/g, "\n"))
          .refine(
            (v) => v.includes("BEGIN PRIVATE KEY"),
            "does not look like a PEM key — copy the whole private_key value from the service account JSON",
          ),
        GOOGLE_SHEET_ID: z.string().min(1, "from the Sheet URL: /spreadsheets/d/<THIS>/edit"),
        GOOGLE_SHEET_TAB: z.string().min(1).default("Form Responses 1"),
      }),
      process.env,
      "Google Sheets sync",
      "Add the service account credentials and Sheet ID to .env, and share the Sheet with the service account email as Viewer.",
    ),
  );
}

// ---------------------------------------------------------------------------
// Gmail SMTP — needed only when sending email.
// ---------------------------------------------------------------------------
export function gmailEnv() {
  assertServer("gmailEnv()");
  return once("gmail", () =>
    parse(
      z.object({
        GMAIL_USER: z.string().email(),
        // App Passwords are 16 characters; Google shows them in groups of four
        // and those spaces are presentation only.
        GMAIL_APP_PASSWORD: z
          .string()
          .min(1)
          .transform((v) => v.replace(/\s+/g, "")),
      }),
      process.env,
      "Gmail sending",
      "Enable 2-Step Verification on the Google account, create an App Password, and put it in .env as GMAIL_APP_PASSWORD.",
    ),
  );
}

// ---------------------------------------------------------------------------
// Branding and certificate ids — all defaulted, so this never fails.
// ---------------------------------------------------------------------------
export function appEnv() {
  assertServer("appEnv()");
  return once("app", () =>
    parse(
      z.object({
        CERT_ID_PREFIX: z.preprocess(
          (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
          z.string().min(1).max(8).default("TS"),
        ),
        ORG_NAME: z.preprocess(
          (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
          z.string().min(1).default("TS Certify"),
        ),
        CRON_SECRET: optionalText,
      }),
      process.env,
      "Application settings",
      "These all have defaults; seeing this means one was set to an invalid value.",
    ),
  );
}
