"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

export interface ResetState {
  error: string | null;
}

export async function updatePassword(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { error: "Those two passwords do not match." };
  }

  // The recovery link signed this browser in. getCurrentUser also rejects
  // deactivated accounts, so a removed colleague cannot set a fresh password
  // even if they still hold an old link.
  const user = await getCurrentUser();
  if (!user) {
    return { error: "This reset link has expired. Request a new one to continue." };
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/admin");
}
