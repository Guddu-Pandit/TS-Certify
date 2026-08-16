import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/config/env";

/** Marks the "Keep me signed in" choice so token refreshes keep honouring it. */
export const REMEMBER_COOKIE = "ts_remember";

/** How long a "remembered" session survives. */
export const REMEMBER_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * Supabase client bound to the request's auth cookies.
 *
 * Use this to find out WHO is making the request. Use supabaseAdmin() to
 * actually read application data — `submissions` and friends have no policies,
 * so this client cannot read them, which is the intended design.
 *
 * `remember` controls how long the auth cookies live. Sign-in passes it
 * explicitly; every later request infers it from REMEMBER_COOKIE, so a token
 * refresh does not silently upgrade a browser-session login into a persistent
 * one.
 */
export async function supabaseServer(opts: { remember?: boolean } = {}) {
  const cookieStore = await cookies();
  const remember = opts.remember ?? cookieStore.get(REMEMBER_COOKIE)?.value === "1";

  return createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              // Unchecked "Keep me signed in" means no maxAge/expires, i.e. a
              // browser-session cookie that dies when the browser closes.
              cookieStore.set(
                name,
                value,
                remember
                  ? { ...options, maxAge: REMEMBER_MAX_AGE }
                  : { ...options, maxAge: undefined, expires: undefined },
              );
            }
          } catch {
            // Server Components cannot set cookies. The middleware refreshes
            // the session on every request, so a failure here is harmless.
          }
        },
      },
    },
  );
}
