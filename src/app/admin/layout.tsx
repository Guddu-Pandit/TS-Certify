import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import {
  AdminShell,
  COLLAPSE_COOKIE,
  NAV_ICONS,
  type NavGroup,
} from "./_components/AdminShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Every /admin page passes through here, so an unauthenticated request never
  // renders admin markup even if middleware were bypassed.
  const user = await requireUser();

  const groups: NavGroup[] = [
    {
      label: "Main",
      items: [
        { href: "/admin", label: "Submissions", icon: NAV_ICONS.inbox },
        { href: "/admin/certificates", label: "Certificates", icon: NAV_ICONS.award },
      ],
    },
    {
      label: "Configure",
      items: [
        { href: "/admin/settings/email", label: "Email", icon: NAV_ICONS.mail },
        { href: "/admin/template", label: "Template", icon: NAV_ICONS.layout },
      ],
    },
  ];

  // Hiding this is convenience only — /admin/users re-checks the role
  // server-side, so an hr user typing the URL still gets sent back.
  if (user.can.manageUsers) {
    groups.push({
      label: "Account",
      items: [{ href: "/admin/users", label: "Users", icon: NAV_ICONS.users }],
    });
  }

  return (
    <AdminShell
      groups={groups}
      userName={user.fullName ?? user.email}
      userRole={user.role === "admin" ? "Administrator" : "HR / Staff"}
      initialCollapsed={(await cookies()).get(COLLAPSE_COOKIE)?.value === "1"}
    >
      {children}
    </AdminShell>
  );
}
