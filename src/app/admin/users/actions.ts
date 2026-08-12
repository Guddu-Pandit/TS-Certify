"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AppRole } from "@/lib/supabase/types";

export interface UserActionState {
  error: string | null;
  success: string | null;
}

/**
 * Every action here re-checks the role server-side. Hiding the nav link for hr
 * users is convenience; this is the actual boundary.
 */
async function assertAdmin(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return "Your session has expired. Sign in again.";
  if (!user.can.manageUsers) return "Only an administrator can manage users.";
  return null;
}

export async function createUser(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const denied = await assertAdmin();
  if (denied) return { error: denied, success: null };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const role = String(formData.get("role") ?? "hr") as AppRole;

  if (!email || !password) return { error: "Email and password are required.", success: null };
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters.", success: null };
  }
  if (role !== "admin" && role !== "hr") {
    return { error: "Pick a valid role.", success: null };
  }

  const admin = supabaseAdmin();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    // No confirmation email: an admin creating the account is the vouching step.
    email_confirm: true,
    // app_metadata is not user-editable, unlike user_metadata. The
    // on_auth_user_created trigger reads the role from here.
    app_metadata: { role },
    user_metadata: fullName ? { full_name: fullName } : {},
  });

  if (error) {
    const exists = error.status === 422 || /already/i.test(error.message);
    return {
      error: exists ? `${email} already has an account.` : error.message,
      success: null,
    };
  }

  // The trigger creates this row; upsert repairs it if the trigger is missing
  // and records the full name, which the trigger only reads from metadata.
  await admin.from("profiles").upsert(
    { id: data.user.id, email, full_name: fullName || null, role, is_active: true },
    { onConflict: "id" },
  );

  revalidatePath("/admin/users");
  return { error: null, success: `Created ${email} as ${role === "admin" ? "administrator" : "HR / staff"}.` };
}

export async function setUserActive(userId: string, isActive: boolean): Promise<void> {
  const denied = await assertAdmin();
  if (denied) throw new Error(denied);

  const me = await getCurrentUser();
  // Deactivating yourself would lock you out of the only page that can undo it.
  if (me?.id === userId && !isActive) {
    throw new Error("You cannot deactivate your own account.");
  }

  const { error } = await supabaseAdmin()
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", userId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/users");
}

export async function setUserRole(userId: string, role: AppRole): Promise<void> {
  const denied = await assertAdmin();
  if (denied) throw new Error(denied);

  const me = await getCurrentUser();
  if (me?.id === userId && role !== "admin") {
    throw new Error("You cannot remove your own administrator access.");
  }

  const admin = supabaseAdmin();

  // Keep app_metadata and profiles in agreement — the trigger reads metadata
  // when a profile is ever recreated.
  const { error: authErr } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { role },
  });
  if (authErr) throw new Error(authErr.message);

  const { error } = await admin.from("profiles").update({ role }).eq("id", userId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/users");
}
