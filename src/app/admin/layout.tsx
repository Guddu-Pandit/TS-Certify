import { requireUser } from "@/lib/auth";
import { NAV_ICONS, Sidebar, type NavItem } from "./_components/Sidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Every /admin page passes through here, so an unauthenticated request never
  // renders admin markup even if middleware were bypassed.
  const user = await requireUser();

  const items: NavItem[] = [
    { href: "/admin", label: "Submissions", icon: NAV_ICONS.inbox },
    { href: "/admin/certificates", label: "Certificates", icon: NAV_ICONS.award },
    { href: "/admin/settings/email", label: "Email", icon: NAV_ICONS.mail },
    { href: "/admin/template", label: "Template", icon: NAV_ICONS.layout },
  ];

  // Hiding this is convenience only — /admin/users re-checks the role
  // server-side, so an hr user typing the URL still gets sent back.
  if (user.can.manageUsers) {
    items.push({ href: "/admin/users", label: "Users", icon: NAV_ICONS.users });
  }

  return (
    <div className="min-h-screen">
      <Sidebar
        items={items}
        userName={user.fullName ?? user.email}
        userRole={user.role === "admin" ? "Administrator" : "HR / Staff"}
      />

      <div className="flex min-h-screen flex-col lg:pl-64">
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
