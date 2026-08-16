import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Landing point for links in Supabase auth emails (password recovery today).
 *
 * Two link shapes are accepted, because which one arrives depends on the email
 * template in the Supabase dashboard:
 *
 *  - `token_hash` + `type` — from a template using {{ .TokenHash }}. Verified
 *    with verifyOtp, which works in ANY browser. Prefer this one.
 *  - `code` — from the default {{ .ConfirmationURL }} template. This is PKCE,
 *    so it only works in the browser that started the reset: the code verifier
 *    lives in a cookie there. Opening the email on a phone after requesting on
 *    a laptop will fail, which is why the template change is worth making.
 *
 * Exchanging here rather than on the page keeps the one-time token out of the
 * page's URL, so it cannot leak via a Referer header or browser history.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");

  // Same-origin paths only, so a crafted ?next=https://evil.example cannot
  // turn a password-reset link into an open redirect.
  const requested = url.searchParams.get("next") ?? "/reset-password";
  const next =
    requested.startsWith("/") && !requested.startsWith("//") ? requested : "/reset-password";

  const supabase = await supabaseServer();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }

  return NextResponse.redirect(new URL("/forgot-password?error=link", url.origin));
}
