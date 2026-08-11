import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/config/env";

let cached: SupabaseClient | null = null;

/**
 * Anonymous Supabase client, used by the public /verify page.
 *
 * Deliberately NOT the service-role client. The verify page is reachable by
 * the whole internet, and using a key that bypasses RLS there would turn one
 * careless select('*') into a data breach. With the anon key, three separate
 * things must fail at once for anything private to leak:
 *
 *   1. certificates contains no email or phone in the first place
 *   2. anon holds column-level grants on only the printed fields (002_rls.sql)
 *   3. the query names its columns explicitly
 */
export function supabasePublic(): SupabaseClient {
  cached ??= createClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return cached;
}
