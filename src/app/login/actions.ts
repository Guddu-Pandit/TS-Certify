"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import {
  REMEMBER_COOKIE,
  REMEMBER_MAX_AGE,
  supabaseServer,
} from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export interface LoginState {
  error: string | null;
}

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/admin");
  const remember = formData.get("remember") === "on";

  if (!email || !password) {
    return { error: "Enter both your email and password." };
  }

  // Passed explicitly: the auth cookies are written during signInWithPassword,
  // before REMEMBER_COOKIE below exists for the client to read.
  const supabase = await supabaseServer({ remember });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    // Deliberately vague: distinguishing "no such account" from "wrong
    // password" would let anyone test which emails have accounts.
    return { error: "Incorrect email or password." };
  }

  // Valid credentials are not enough — the account must also still be active.
  // Checked with the service-role key because `profiles` denies everything to
  // anon and only lets a signed-in user read their own row.
  const { data: profile } = await supabaseAdmin()
    .from("profiles")
    .select("is_active")
    .eq("id", data.user.id)
    .maybeSingle<{ is_active: boolean }>();

  if (!profile) {
    await supabase.auth.signOut();
    return { error: "This account has no access profile. Ask an admin to re-create it." };
  }
  if (!profile.is_active) {
    await supabase.auth.signOut();
    return { error: "This account has been deactivated." };
  }

  // Remember the choice so later token refreshes reuse the same lifetime.
  const jar = await cookies();
  if (remember) {
    jar.set(REMEMBER_COOKIE, "1", {
      maxAge: REMEMBER_MAX_AGE,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
    });
  } else {
    jar.delete(REMEMBER_COOKIE);
  }

  revalidatePath("/", "layout");
  // Only same-site paths, so a crafted ?next=https://evil.example cannot turn
  // the login form into an open redirect.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/admin";
  redirect(safeNext);
}

export async function signOut() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  (await cookies()).delete(REMEMBER_COOKIE);
  revalidatePath("/", "layout");
  redirect("/login");
}
