import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata = { title: "Choose a new password · TS-Certify" };

// The recovery session is read from cookies, so this can never be cached.
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage() {
  // /auth/confirm signs the browser in before redirecting here. No user means
  // the link was bad, expired, already used, or opened in another browser.
  const user = await getCurrentUser();

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#131211] px-4 py-10">
      <div className="w-full max-w-md bg-[#f3f2f2] px-6 py-10 text-[#201e1d] shadow-[0_40px_90px_rgba(0,0,0,0.55)] sm:px-12 sm:py-14">
        <div className="flex items-center gap-2.5">
          <span className="flex h-5 w-2.5 flex-col" aria-hidden="true">
            <span className="flex-1 bg-[#1a1f3d]" />
            <span className="h-1.5 bg-[#f0a422]" />
          </span>
          <span className="font-display text-base font-bold tracking-[-0.01em]">TS Certify</span>
        </div>

        {user ? (
          <>
            <h1 className="font-display mt-10 text-[30px] leading-[1.05] font-bold tracking-[-0.035em]">
              Choose a new password
            </h1>
            <p className="mt-2.5 text-sm leading-relaxed text-[#605d5d]">
              Setting a new password for <span className="font-medium">{user.email}</span>. You will
              be signed in straight afterwards.
            </p>

            <div className="mt-8">
              <ResetPasswordForm />
            </div>
          </>
        ) : (
          <>
            <h1 className="font-display mt-10 text-[30px] leading-[1.05] font-bold tracking-[-0.035em]">
              This link has expired
            </h1>
            <p className="mt-2.5 text-sm leading-relaxed text-[#605d5d]">
              Reset links last one hour and can only be used once. They also have to be opened in
              the same browser you requested them from.
            </p>

            <Link
              href="/forgot-password"
              className="font-display mt-8 flex w-full items-center justify-between bg-[#1a1f3d] px-[18px] py-[15px] text-sm font-bold text-[#f3f2f2] transition-colors hover:bg-[#2b3358]"
            >
              <span className="whitespace-nowrap">Request a new link</span>
              <span aria-hidden="true" className="text-[#f0a422]">
                →
              </span>
            </Link>
          </>
        )}

        <div className="mt-9 border-t border-[#d7d3d3] pt-3.5">
          <Link
            href="/login"
            className="text-[13px] text-[#1a1f3d] underline underline-offset-[3px] hover:text-[#3d4780]"
          >
            ← Back to sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
