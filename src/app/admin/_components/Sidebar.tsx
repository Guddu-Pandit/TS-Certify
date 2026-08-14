"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/login/actions";

export interface NavItem {
  href: string;
  label: string;
  /** Inline path data, so the shell pulls in no icon dependency. */
  icon: string;
}

/**
 * All 20x20, stroke-based, drawn on the same grid so they align optically.
 */
export const NAV_ICONS = {
  inbox: "M3 12h4l2 3h6l2-3h4M5 5h14l2 7v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5l2-7Z",
  award: "M12 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM8.5 12.5 7 21l5-2.5L17 21l-1.5-8.5",
  mail: "M3 6h18v12H3zM3 7l9 6 9-6",
  layout: "M4 4h16v6H4zM4 14h7v6H4zM15 14h5v6h-5z",
  users: "M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM20 19v-1.5a3.5 3.5 0 0 0-2.6-3.4M15.4 4.6a3.5 3.5 0 0 1 0 6.8",
} as const;

function Icon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-[18px] w-[18px] shrink-0"
    >
      <path d={d} />
    </svg>
  );
}

/** Matches the old NavLink rule: /admin owns its submission detail pages. */
function isActive(pathname: string, href: string) {
  return href === "/admin"
    ? pathname === href || pathname.startsWith("/admin/submissions")
    : pathname.startsWith(href);
}

export function Sidebar({
  items,
  userName,
  userRole,
}: {
  items: NavItem[];
  userName: string;
  userRole: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Escape closes it, matching the dialog conventions used elsewhere.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const initials =
    userName
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?";

  const nav = (
    <>
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex h-5 w-2.5 flex-col" aria-hidden="true">
          <span className="flex-1 bg-white/85" />
          <span className="h-1.5 bg-accent" />
        </span>
        <span className="font-display text-[15px] font-bold tracking-tight text-white">
          TS-Certify
        </span>
      </div>

      <nav className="flex-1 space-y-0.5 px-3" aria-label="Admin sections">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              // Dismisses the mobile drawer on navigation. A no-op at lg,
              // where the sidebar is always visible.
              onClick={() => setOpen(false)}
              aria-current={active ? "page" : undefined}
              className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                active
                  ? "bg-white/12 font-medium text-white"
                  : "text-white/65 hover:bg-white/8 hover:text-white"
              }`}
            >
              {active ? (
                <span
                  aria-hidden="true"
                  className="absolute top-1.5 bottom-1.5 -left-3 w-[3px] rounded-r bg-accent"
                />
              ) : null}
              <Icon d={item.icon} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-white/12 p-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <span
            aria-hidden="true"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-[11px] font-bold text-brand"
          >
            {initials}
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[13px] font-medium text-white">{userName}</span>
            <span className="block truncate text-[11px] text-white/55">{userRole}</span>
          </span>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="mt-1 w-full rounded-lg px-2 py-2 text-left text-[13px] text-white/65 transition hover:bg-white/8 hover:text-white"
          >
            Sign out
          </button>
        </form>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile bar. Hidden once the persistent sidebar appears at lg. */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          aria-expanded={open}
          className="rounded-lg border border-line p-2 text-muted transition hover:bg-brand-soft hover:text-brand"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
            className="h-4 w-4"
          >
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <span className="font-display text-sm font-bold tracking-tight text-brand">TS-Certify</span>
      </div>

      {open ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-brand/45 lg:hidden"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-brand transition-transform duration-200 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {nav}
      </aside>
    </>
  );
}
