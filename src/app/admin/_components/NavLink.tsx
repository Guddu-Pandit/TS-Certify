"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  // /admin would otherwise prefix-match every other tab, so it matches only
  // itself — plus the submission detail pages, which belong to it.
  const active =
    href === "/admin"
      ? pathname === href || pathname.startsWith("/admin/submissions")
      : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        active ? "bg-brand-soft text-brand" : "text-muted hover:bg-brand-soft/60 hover:text-brand"
      }`}
    >
      {children}
    </Link>
  );
}
