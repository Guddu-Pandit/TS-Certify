"use server";

import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { siteUrl } from "@/config/env";

export interface ForgotState {
  error: string | null;
  sent: boolean;
}

export async function requestReset(
  _prev: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!email) return { error: "Enter your email address.", sent: false };

  // Look the account up with the service-role key: `profiles` denies anon, and
  // only lets a signed-in user read their own row — and nobody is signed in here.
  const { data: profile } = await supabaseAdmin()
    .from("profiles")
    .select("is_active")
    .eq("email", email)
    .maybeSingle<{ is_active: boolean }>();

  // Deactivated accounts get nothing. Sign-in would reject them anyway, so a
  // reset link would only be a dead end — and letting a removed colleague set
  // a fresh password is not a thing worth allowing.
  if (profile?.is_active) {
    const supabase = await supabaseServer();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/auth/confirm?next=/reset-password`,
    });
  }

  // Identical response whether or not the address exists. Anything else turns
  // this form into a way to discover who has an account.
  return { error: null, sent: true };
}
