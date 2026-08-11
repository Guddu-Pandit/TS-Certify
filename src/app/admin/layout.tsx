import { requireUser } from "@/lib/auth";
import { signOut } from "@/app/login/actions";
import { NavLink } from "./_components/NavLink";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Every /admin page passes through here, so an unauthenticated request never
  // renders admin markup even if middleware were bypassed.
  const user = await requireUser();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <span className="text-base font-bold tracking-tight text-brand">TS-Certify</span>

          <nav className="flex items-center gap-1">
            {/* Entries are added here as each stage lands, so the nav never
                points at a page that does not exist yet. */}
            <NavLink href="/admin">Submissions</NavLink>
            <NavLink href="/admin/template">Template</NavLink>
            <NavLink href="/admin/settings/email">Email</NavLink>
            {/* Hiding this is convenience only — /admin/users re-checks the
                role server-side, so an hr user typing the URL still gets sent
                back. */}
            {user.can.manageUsers ? <NavLink href="/admin/users">Users</NavLink> : null}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <div className="text-right leading-tight">
              <div className="text-sm font-medium">{user.fullName ?? user.email}</div>
              <div className="text-xs text-muted">
                {user.role === "admin" ? "Administrator" : "HR / Staff"}
              </div>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-muted transition hover:bg-brand-soft hover:text-brand"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
