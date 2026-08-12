"use client";

import { useState, useTransition } from "react";
import type { AppRole } from "@/lib/supabase/types";
import { setUserActive, setUserRole } from "./actions";

export interface UserRowData {
  id: string;
  email: string;
  full_name: string | null;
  role: AppRole;
  is_active: boolean;
  created_at: string;
}

const TD = "px-3 py-3 text-sm align-middle";

export function UserRow({ user, isSelf }: { user: UserRowData; isSelf: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<void>) => {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  };

  return (
    <tr className={`border-b border-line last:border-0 ${user.is_active ? "" : "opacity-55"}`}>
      <td className={`${TD} font-medium`}>
        {user.full_name ?? "—"}
        {isSelf ? <span className="ml-2 text-xs font-normal text-muted">(you)</span> : null}
      </td>
      <td className={`${TD} text-muted`}>{user.email}</td>

      <td className={TD}>
        <select
          value={user.role}
          disabled={pending || isSelf}
          onChange={(e) => run(() => setUserRole(user.id, e.target.value as AppRole))}
          title={isSelf ? "You cannot change your own role." : undefined}
          className="rounded-lg border border-line bg-surface px-2 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="hr">HR / Staff</option>
          <option value="admin">Administrator</option>
        </select>
      </td>

      <td className={TD}>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
            user.is_active
              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
              : "bg-slate-100 text-slate-600 ring-slate-200"
          }`}
        >
          {user.is_active ? "Active" : "Deactivated"}
        </span>
      </td>

      <td className={TD}>
        <button
          type="button"
          disabled={pending || isSelf}
          onClick={() => run(() => setUserActive(user.id, !user.is_active))}
          title={isSelf ? "You cannot deactivate your own account." : undefined}
          className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "…" : user.is_active ? "Deactivate" : "Reactivate"}
        </button>
        {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
      </td>
    </tr>
  );
}
