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

export interface NavGroup {
  /** Section heading. Hidden when the rail is collapsed. */
  label: string;
  items: NavItem[];
}

/** All 24x24, stroke-based, drawn on one grid so they align optically. */
export const NAV_ICONS = {
  inbox: "M3 12h4l2 3h6l2-3h4M5 5h14l2 7v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5l2-7Z",
  award: "M12 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM8.5 12.5 7 21l5-2.5L17 21l-1.5-8.5",
  mail: "M3 6h18v12H3zM3 7l9 6 9-6",
  layout: "M4 4h16v6H4zM4 14h7v6H4zM15 14h5v6h-5z",
  users:
    "M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM20 19v-1.5a3.5 3.5 0 0 0-2.6-3.4M15.4 4.6a3.5 3.5 0 0 1 0 6.8",
  /** Brand mark: a shield with a check — the app's whole job is verification. */
  shield: "M12 3l7 3v6c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6l7-3ZM9 12l2 2 4-4",
  collapse: "M4 4v16M19 8l-4 4 4 4M15 12h-5",
  expand: "M4 4v16M11 8l4 4-4 4M15 12h5",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6 18 18M18 6 6 18",
  signOut: "M15 17l5-5-5-5M20 12H9M12 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6",
} as const;

/**
 * Collapse preference lives in a cookie rather than localStorage so the layout
 * can read it on the server and render the correct width immediately — no
 * flash of an expanded sidebar on every page load.
 */
export const COLLAPSE_COOKIE = "ts_admin_sidebar";

function Icon({ d, className = "h-[18px] w-[18px]" }: { d: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <path d={d} />
    </svg>
  );
}

/** /admin would prefix-match everything, so it owns only itself and its details. */
function isActive(pathname: string, href: string) {
  return href === "/admin"
    ? pathname === href || pathname.startsWith("/admin/submissions")
    : pathname.startsWith(href);
}

export function AdminShell({
  groups,
  userName,
  userRole,
  initialCollapsed,
  children,
}: {
  groups: NavGroup[];
  userName: string;
  userRole: string;
  initialCollapsed: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${COLLAPSE_COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  }

  // Escape closes the drawer, matching the dialog conventions used elsewhere.
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

  // The drawer is always full width; only the desktop rail collapses.
  const railed = collapsed && !open;

  return (
    <div className="min-h-screen">
      {open ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-brand/40 lg:hidden"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-line bg-surface transition-all duration-200 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        } ${railed ? "w-[72px]" : "w-64"}`}
      >
        {/* Brand */}
        <div
          className={`flex h-16 shrink-0 items-center gap-2.5 border-b border-line ${
            railed ? "justify-center px-2" : "px-4"
          }`}
        >
          <Link href="/admin" className="flex items-center gap-2.5" title="TS-Certify">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand text-accent">
              <Icon d={NAV_ICONS.shield} className="h-5 w-5" />
            </span>
            {railed ? null : (
              <span className="font-display text-[15px] font-bold tracking-tight text-brand">
                TS-Certify
              </span>
            )}
          </Link>

          {railed ? null : (
            <>
              <button
                type="button"
                onClick={toggleCollapsed}
                aria-label="Collapse sidebar"
                className="ml-auto hidden rounded-lg p-1.5 text-muted transition hover:bg-brand-soft hover:text-brand lg:block"
              >
                <Icon d={NAV_ICONS.collapse} />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="ml-auto rounded-lg p-1.5 text-muted transition hover:bg-brand-soft hover:text-brand lg:hidden"
              >
                <Icon d={NAV_ICONS.close} />
              </button>
            </>
          )}
        </div>

        {/* Sections */}
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Admin sections">
          {groups.map((group) => (
            <div key={group.label}>
              {railed ? (
                <div className="mx-3 mb-2 h-px bg-line" />
              ) : (
                <div className="mb-1.5 px-3 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
                  {group.label}
                </div>
              )}

              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      // Dismisses the drawer on navigation; a no-op at lg.
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      title={railed ? item.label : undefined}
                      className={`flex items-center gap-3 rounded-lg py-2.5 text-sm transition ${
                        railed ? "justify-center px-2" : "px-3"
                      } ${
                        active
                          ? "bg-brand-soft font-semibold text-brand"
                          : "text-muted hover:bg-brand-soft/60 hover:text-brand"
                      }`}
                    >
                      <Icon d={item.icon} />
                      {railed ? null : item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Account */}
        <div className="shrink-0 border-t border-line p-3">
          <div
            className={`flex items-center gap-2.5 rounded-lg px-2 py-2 ${
              railed ? "justify-center" : ""
            }`}
            title={railed ? `${userName} · ${userRole}` : undefined}
          >
            <span
              aria-hidden="true"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-soft text-[11px] font-bold text-brand"
            >
              {initials}
            </span>
            {railed ? null : (
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-[13px] font-medium">{userName}</span>
                <span className="block truncate text-[11px] text-muted">{userRole}</span>
              </span>
            )}
          </div>

          <form action={signOut}>
            <button
              type="submit"
              title={railed ? "Sign out" : undefined}
              className={`mt-0.5 flex w-full items-center gap-3 rounded-lg py-2.5 text-sm text-muted transition hover:bg-brand-soft hover:text-brand ${
                railed ? "justify-center px-2" : "px-3"
              }`}
            >
              <Icon d={NAV_ICONS.signOut} />
              {railed ? null : "Sign out"}
            </button>
          </form>
        </div>
      </aside>

      {/* Content, offset by whichever rail width is showing */}
      <div className={`transition-all duration-200 ${collapsed ? "lg:pl-[72px]" : "lg:pl-64"}`}>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-surface px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
            aria-expanded={open}
            className="-ml-1 rounded-lg p-2 text-muted transition hover:bg-brand-soft hover:text-brand lg:hidden"
          >
            <Icon d={NAV_ICONS.menu} className="h-5 w-5" />
          </button>

          {collapsed ? (
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Expand sidebar"
              className="hidden rounded-lg p-2 text-muted transition hover:bg-brand-soft hover:text-brand lg:block"
            >
              <Icon d={NAV_ICONS.expand} className="h-5 w-5" />
            </button>
          ) : null}

          <span className="font-display text-sm font-bold tracking-tight text-brand lg:hidden">
            TS-Certify
          </span>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
