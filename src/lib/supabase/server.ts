import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/config/env";

/**
 * Supabase client bound to the request's auth cookies.
 *
 * Use this to find out WHO is making the request. Use supabaseAdmin() to
 * actually read application data — `submissions` and friends have no policies,
 * so this client cannot read them, which is the intended design.
 */
export async function supabaseServer() {
  const cookieStore = await cookies();

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
              cookieStore.set(name, value, options);
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
