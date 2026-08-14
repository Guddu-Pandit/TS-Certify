"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updatePassword, type ResetState } from "./actions";

const labelClass = "font-code text-[11px] uppercase tracking-[0.1em] text-[#444141]";
const fieldClass =
  "w-full border border-[#bab6b6] bg-white px-3.5 py-3 text-sm text-[#201e1d] outline-none transition-colors placeholder:text-[#9b9797] focus:border-[#1a1f3d]";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="font-display mt-6 flex w-full items-center justify-between bg-[#1a1f3d] px-[18px] py-[15px] text-sm font-bold text-[#f3f2f2] transition-colors hover:bg-[#2b3358] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a1f3d] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="whitespace-nowrap">{pending ? "Saving…" : "Save new password"}</span>
      <span aria-hidden="true" className="text-[#f0a422]">
        →
      </span>
    </button>
  );
}

export function ResetPasswordForm() {
  const [state, formAction] = useActionState<ResetState, FormData>(updatePassword, {
    error: null,
  });

  return (
    <form action={formAction}>
      <label className="mb-[18px] flex flex-col gap-[7px]">
        <span className={labelClass}>New password</span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          minLength={8}
          required
          autoFocus
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-[7px]">
        <span className={labelClass}>Confirm new password</span>
        <input
          name="confirm"
          type="password"
          autoComplete="new-password"
          placeholder="Type it again"
          minLength={8}
          required
          className={fieldClass}
        />
      </label>

      {state.error ? (
        <p
          role="alert"
          className="mt-[18px] border-l-2 border-[#ec3013] bg-[#ffe0d9] px-3.5 py-2.5 text-sm text-[#7c1405]"
        >
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
