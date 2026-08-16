import Link from "next/link";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata = { title: "Reset password · TS-Certify" };

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

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

        <h1 className="font-display mt-10 text-[30px] leading-[1.05] font-bold tracking-[-0.035em]">
          Reset your password
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed text-[#605d5d]">
          Enter the email you sign in with and we&rsquo;ll send you a link to choose a new password.
        </p>

        {/* Set by /auth/confirm when a link is expired, already used, or opened
            in a different browser than the one that requested it. */}
        {error === "link" ? (
          <p
            role="alert"
            className="mt-6 border-l-2 border-[#ec3013] bg-[#ffe0d9] px-3.5 py-2.5 text-[13px] leading-relaxed text-[#7c1405]"
          >
            That reset link is no longer valid — it may have expired, been used already, or been
            opened in a different browser. Request a new one below.
          </p>
        ) : null}

        <div className="mt-8">
          <ForgotPasswordForm />
        </div>

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
