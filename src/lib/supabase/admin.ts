// This import makes Next.js fail the BUILD if any client component ever
// imports this module, instead of silently shipping the service-role key to
// browsers. Do not remove it.
import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/config/env";

let cached: SupabaseClient | null = null;

/**
 * Service-role Supabase client.
 *
 * Bypasses RLS entirely — it is the mechanism by which the admin UI reads
 * `submissions`, which has no policies at all. Only ever call this from route
 * handlers, server actions, server components, or scripts.
 */
export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  cached = createClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv().SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      // There is no user session here, and persisting one would be wrong:
      // this client's authority comes from the key, not from a logged-in user.
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cached;
}
