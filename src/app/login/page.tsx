import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

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
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-brand">TS-Certify</h1>
          <p className="mt-1.5 text-sm text-muted">Certificate issuing &amp; verification</p>
        </div>

        <div className="rounded-xl border border-line bg-surface p-6 shadow-sm">
          <LoginForm next={next ?? "/admin"} />
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          Accounts are created by an administrator. There is no public sign-up.
        </p>
      </div>
    </main>
  );
}
