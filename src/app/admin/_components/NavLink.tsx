"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  // /admin must match only itself; every other entry also matches its subpages.
  const active = href === "/admin" ? pathname === href : pathname.startsWith(href);

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
