/**
 * Shared nav constants.
 *
 * Deliberately NOT in AdminShell.tsx: that file is "use client", and every
 * export of a client module becomes a client-reference proxy when a server
 * component imports it. `NAV_ICONS.inbox` read from the server layout would
 * come back undefined rather than the path string — rendering an empty <path>
 * with no error to show for it. Plain modules like this one cross the boundary
 * as real values.
 */

export interface NavItem {
  href: string;
  label: string;
  /** Inline path data, so the shell pulls in no icon dependency. */
  icon: string;
}

/** All 24x24, stroke-based, drawn on one grid so they align optically. */
export const NAV_ICONS = {
  /** Submissions — an inbox tray. */
  inbox: "M3 12h4l2 3h6l2-3h4M5 5h14l2 7v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5l2-7Z",
  /** Certificates — a rosette seal with ribbons. */
  award: "M12 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM8.5 12.5 7 21l5-2.5L17 21l-1.5-8.5",
  /** Email — an envelope. */
  mail: "M3 6h18v12H3zM3 7l9 6 9-6",
  /** Template — page panels. */
  layout: "M4 4h16v6H4zM4 14h7v6H4zM15 14h5v6h-5z",
  /** Users — two figures. */
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
