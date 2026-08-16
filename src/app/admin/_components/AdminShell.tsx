"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/login/actions";
import { COLLAPSE_COOKIE, NAV_ICONS, type NavItem } from "./nav";

/**
 * Size is set as width/height attributes rather than utility classes: the
 * value would otherwise live inside a default parameter string, which is not
 * a reliable place for Tailwind's scanner to find a candidate class.
 */
function Icon({ d, size = 18, className = "" }: { d: string; size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
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
  items,
  userName,
  userRole,
  initialCollapsed,
  children,
}: {
  items: NavItem[];
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
              <Icon d={NAV_ICONS.shield} size={20} />
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

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4" aria-label="Admin sections">
          {items.map((item) => {
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
            <Icon d={NAV_ICONS.menu} size={20} />
          </button>

          {collapsed ? (
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Expand sidebar"
              className="hidden rounded-lg p-2 text-muted transition hover:bg-brand-soft hover:text-brand lg:block"
            >
              <Icon d={NAV_ICONS.expand} size={20} />
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
