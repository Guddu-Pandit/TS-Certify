"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { resetLayout, saveLayout } from "@/lib/certificate/layout";

export interface LayoutActionState {
  error: string | null;
  success: string | null;
}

/**
 * Saves the field positions edited at /admin/template.
 *
 * The payload arrives as a plain object rather than FormData: it is a nested
 * document with numbers and booleans, and flattening it into form fields would
 * mean re-parsing every value on the way back in. `saveLayout` validates it
 * against the same schema the renderer reads with, so nothing gets stored that
 * would later fail to draw.
 */
export async function saveLayoutAction(layout: unknown): Promise<LayoutActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has expired. Sign in again.", success: null };
  if (!user.can.editTemplateLayout) {
    return { error: "Your account cannot change the certificate layout.", success: null };
  }

  const result = await saveLayout(layout, user.id);
  if (!result.ok) return { error: result.error, success: null };

  revalidatePath("/admin/template");
  return {
    error: null,
    success: "Saved. Certificates generated from now on use these positions.",
  };
}

/** Deletes the saved layout, so the defaults in src/config/template.ts apply again. */
export async function resetLayoutAction(): Promise<LayoutActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has expired. Sign in again.", success: null };
  if (!user.can.editTemplateLayout) {
    return { error: "Your account cannot change the certificate layout.", success: null };
  }

  const result = await resetLayout();
  if (!result.ok) return { error: result.error, success: null };

  revalidatePath("/admin/template");
  return { error: null, success: "Reset to the built-in defaults." };
}
