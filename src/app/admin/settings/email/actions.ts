"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CERTIFICATE_EMAIL_TEMPLATE_KEY } from "@/lib/supabase/types";

export interface TemplateFormState {
  error: string | null;
  success: string | null;
}

export async function saveEmailTemplate(
  _prev: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has expired. Sign in again.", success: null };

  const subject = String(formData.get("subject") ?? "").trim();
  const bodyHtml = String(formData.get("body_html") ?? "").trim();
  const bodyText = String(formData.get("body_text") ?? "").trim();
  const attachmentName = String(formData.get("attachment_name") ?? "").trim();

  if (!subject) return { error: "Subject cannot be empty.", success: null };
  if (!bodyHtml || !bodyText) {
    return { error: "Both the HTML and plain-text bodies are required.", success: null };
  }
  if (!attachmentName) return { error: "Attachment filename cannot be empty.", success: null };

  // Stored in the database rather than in code, so the wording can change
  // without a redeploy.
  const { error } = await supabaseAdmin().from("email_templates").upsert(
    {
      key: CERTIFICATE_EMAIL_TEMPLATE_KEY,
      subject,
      body_html: bodyHtml,
      body_text: bodyText,
      attachment_name: attachmentName,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  if (error) return { error: error.message, success: null };

  revalidatePath("/admin/settings/email");
  return { error: null, success: "Saved. New emails will use this wording." };
}
