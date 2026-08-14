import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";
import { LoginArt } from "./LoginArt";

export const metadata = { title: "Sign in · TS-Certify" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  // Already signed in — skip the form.
  const user = await getCurrentUser();
  if (user) redirect("/admin");

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#131211] px-4 py-8 sm:px-8 sm:py-12">
      <div className="grid w-full max-w-310 bg-[#f3f2f2] text-[#201e1d] shadow-[0_40px_90px_rgba(0,0,0,0.55)] lg:grid-cols-2">
        {/* Below lg the columns stack, so the banner leads and the tall
            panel at the end of the grid is hidden. */}
        <div className="relative h-40 overflow-hidden sm:h-52 lg:hidden">
          <LoginArt />
        </div>

        <div className="flex flex-col px-6 py-12 sm:px-16 sm:py-16">
          <div className="flex items-center gap-2.5">
            <span className="flex h-5 w-2.5 flex-col">
              <span className="flex-1 bg-[#1a1f3d]" />
              <span className="h-1.5 bg-[#f0a422]" />
            </span>
            <span className="font-display text-base font-bold tracking-[-0.01em] whitespace-nowrap">
              TS Certify
            </span>
          </div>

          <div className="mt-11 lg:mt-12">
            <h1 className="font-display text-[34px] leading-[1.05] font-bold tracking-[-0.035em] lg:text-[42px]">
              Welcome back
            </h1>
            <p className="mt-2.5 max-w-[38ch] text-sm leading-relaxed text-[#605d5d]">
              Sign in to issue, re-send and verify internship certificates.
            </p>
          </div>

          <div className="mt-8">
            <LoginForm next={next ?? "/admin"} />
          </div>

          <div className="mt-auto pt-9">
            <div className="h-px bg-[#d7d3d3]" />
            <p className="mt-3.5 text-[12.5px] leading-relaxed text-[#605d5d]">
              Accounts are created by an administrator. There is no public sign-up — contact{" "}
              <a
                href="https://tech-synergy.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1a1f3d] underline underline-offset-[3px] hover:text-[#3d4780]"
              >
                Tech Synergy
              </a>
              .
            </p>
          </div>
        </div>

        <div className="relative hidden min-h-[780px] overflow-hidden lg:block">
          <LoginArt />

          <span className="absolute top-8 left-8 bg-[#1a1f3d] px-[9px] py-1.5 font-code text-[10px] tracking-[0.16em] whitespace-nowrap text-[#f0a422] uppercase">
            Internal tool
          </span>

        </div>
      </div>
    </main>
  );
}
