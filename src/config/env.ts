import { z } from "zod";

/**
 * Validated environment access.
 *
 * Everything is checked once, at first import, so a missing or malformed
 * variable fails loudly with the variable's name instead of surfacing three
 * layers deep as `undefined is not a function`.
 *
 * Split into two schemas because Next.js only inlines NEXT_PUBLIC_* into the
 * browser bundle. Server variables are simply absent client-side, so validating
 * them together would throw on every client render.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("must be the full https://... project URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_SITE_URL: z
    .string()
    .url("must include the protocol, e.g. http://localhost:3000")
    // A trailing slash would produce `https://site.com//verify/...` in QR codes.
    .transform((v) => v.replace(/\/+$/, "")),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),

  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().email(),
  // The JSON key's private_key holds real newlines. Stored in .env as a
  // single quoted line with literal \n, so unescape it here. On Vercel the value
  // is pasted with real newlines and this replace is a harmless no-op.
  GOOGLE_PRIVATE_KEY: z
    .string()
    .min(1)
    .transform((v) => v.replace(/\\n/g, "\n"))
    .refine(
      (v) => v.includes("BEGIN PRIVATE KEY"),
      "does not look like a PEM key — copy the full private_key value from the service account JSON",
    ),
  GOOGLE_SHEET_ID: z.string().min(1),
  GOOGLE_SHEET_TAB: z.string().min(1).default("Form Responses 1"),

  GMAIL_USER: z.string().email(),
  // App Passwords are 16 characters. Google displays them in groups of four;
  // the spaces are presentation only and must not be stored.
  GMAIL_APP_PASSWORD: z
    .string()
    .min(1)
    .transform((v) => v.replace(/\s+/g, "")),

  CERT_ID_PREFIX: z.string().min(1).max(8).default("TS"),
  ORG_NAME: z.string().min(1).default("TS Certify"),

  CRON_SECRET: z.string().min(1).optional(),
});

function parse<T extends z.ZodTypeAny>(schema: T, source: Record<string, unknown>, label: string): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid ${label} environment variables:\n${details}\n\nCheck .env against .env.example.`,
    );
  }
  return result.data;
}

export const publicEnv = parse(
  publicSchema,
  {
    // These must be referenced as full literals, not process.env[key], or the
    // Next.js build-time inliner cannot substitute them into the client bundle.
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  },
  "public",
);

let cachedServerEnv: z.infer<typeof serverSchema> | null = null;

/**
 * Server-only variables. Call this inside route handlers and server components,
 * never at module scope of anything a client component can reach.
 */
export function serverEnv(): z.infer<typeof serverSchema> {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() was called in the browser — this would leak secrets.");
  }
  cachedServerEnv ??= parse(serverSchema, process.env, "server");
  return cachedServerEnv;
}

/** The origin QR codes and verification links are built from. */
export const siteUrl = publicEnv.NEXT_PUBLIC_SITE_URL;
