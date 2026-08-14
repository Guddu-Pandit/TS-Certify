import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { AdminShell } from "./_components/AdminShell";
// From the plain module, not AdminShell: see the note in nav.ts.
import { COLLAPSE_COOKIE, NAV_ICONS, type NavItem } from "./_components/nav";

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
    <AdminShell
      items={items}
      userName={user.fullName ?? user.email}
      userRole={user.role === "admin" ? "Administrator" : "HR / Staff"}
      initialCollapsed={(await cookies()).get(COLLAPSE_COOKIE)?.value === "1"}
    >
      {children}
    </AdminShell>
  );
}
