"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { createUser, type UserActionState } from "./actions";

const FIELD =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "Creating…" : "Create user"}
    </button>
  );
}

export function CreateUserForm() {
  const [state, formAction] = useActionState<UserActionState, FormData>(createUser, {
    error: null,
    success: null,
  });
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the fields after a success so the password does not linger on screen.
  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="full_name" className="block text-sm font-medium">
            Full name
          </label>
          <input id="full_name" name="full_name" type="text" className={FIELD} placeholder="Asha Rao" />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="new-email" className="block text-sm font-medium">
            Email <span className="text-red-600">*</span>
          </label>
          <input id="new-email" name="email" type="email" required className={FIELD} autoComplete="off" />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="new-password" className="block text-sm font-medium">
            Password <span className="text-red-600">*</span>
          </label>
          <input
            id="new-password"
            name="password"
            type="text"
            required
            minLength={8}
            className={`${FIELD} font-mono`}
            autoComplete="off"
            placeholder="at least 8 characters"
          />
          <p className="text-xs text-muted">
            Shown in plain text so you can copy it — send it to them, and have them change it.
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="role" className="block text-sm font-medium">
            Role
          </label>
          <select id="role" name="role" defaultValue="hr" className={FIELD}>
            <option value="hr">HR / Staff — sync, generate, email</option>
            <option value="admin">Administrator — everything, incl. users</option>
          </select>
        </div>
      </div>

      {state.error ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.success}
        </p>
      ) : null}

      <Submit />
    </form>
  );
}
