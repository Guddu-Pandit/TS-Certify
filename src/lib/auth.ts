import "server-only";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { can, type AppRole, type ProfileRow } from "@/lib/supabase/types";

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string | null;
  role: AppRole;
  /** Capability flags — prefer `user.can.manageUsers` over `role === 'admin'`. */
  can: ReturnType<typeof can>;
}

/**
 * The signed-in user, or null.
 *
 * The session comes from the request cookies, but the ROLE is read with the
 * service-role key. That matters: a user can influence their own JWT claims,
 * but they cannot write to `profiles`, so the role is always the one an admin
 * assigned.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await supabaseServer();

  // getUser() revalidates the token against Supabase. getSession() would just
  // decode the cookie, which a client could have tampered with.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const { data: profile } = await supabaseAdmin()
    .from("profiles")
    .select("id, email, full_name, role, is_active")
    .eq("id", user.id)
    .maybeSingle<Pick<ProfileRow, "id" | "email" | "full_name" | "role" | "is_active">>();

  // No profile row, or deactivated: treat as signed out. Deactivating a user
  // in /admin/users therefore locks them out on their very next request,
  // without needing to delete their auth account.
  if (!profile || !profile.is_active) return null;

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role,
    can: can(profile.role),
  };
}

/** For pages: returns the user or redirects to /login. */
export async function requireUser(returnTo?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : "/login");
  }
  return user;
}

/** For admin-only pages: returns the user or redirects away. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.can.manageUsers) redirect("/admin?error=admin_only");
  return user;
}

/**
 * For API route handlers. Returns a Response to hand straight back on failure,
 * so routes never have to construct 401/403 bodies themselves.
 */
export async function requireApiUser(
  opts: { admin?: boolean } = {},
): Promise<{ user: CurrentUser; error: null } | { user: null; error: Response }> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      user: null,
      error: Response.json({ ok: false, error: "Not signed in." }, { status: 401 }),
    };
  }
  if (opts.admin && !user.can.manageUsers) {
    return {
      user: null,
      error: Response.json(
        { ok: false, error: "This action requires an admin account." },
        { status: 403 },
      ),
    };
  }

  return { user, error: null };
}
