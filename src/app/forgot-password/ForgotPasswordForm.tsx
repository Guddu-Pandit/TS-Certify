"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { requestReset, type ForgotState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="font-display mt-6 flex w-full items-center justify-between bg-[#1a1f3d] px-[18px] py-[15px] text-sm font-bold text-[#f3f2f2] transition-colors hover:bg-[#2b3358] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a1f3d] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="whitespace-nowrap">{pending ? "Sending…" : "Send reset link"}</span>
      <span aria-hidden="true" className="text-[#f0a422]">
        →
      </span>
    </button>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState<ForgotState, FormData>(requestReset, {
    error: null,
    sent: false,
  });

  if (state.sent) {
    return (
      <div>
        <div className="border-l-2 border-[#1a1f3d] bg-[#eef1f8] px-4 py-3">
          <p className="text-sm font-semibold text-[#1a1f3d]">Check your inbox</p>
          <p className="mt-1 text-[13px] leading-relaxed text-[#605d5d]">
            If that address has an active account, a link to set a new password is on its way. It
            expires in one hour.
          </p>
        </div>
        <p className="mt-6 text-[13px] text-[#605d5d]">
          Nothing arrived? Check spam, or{" "}
          <Link
            href="/forgot-password"
            className="text-[#1a1f3d] underline underline-offset-[3px] hover:text-[#3d4780]"
          >
            try again
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <form action={formAction}>
      <label className="flex flex-col gap-[7px]">
        <span className="font-code text-[11px] tracking-[0.1em] text-[#444141] uppercase">
          Work email
        </span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          placeholder="name@tech-synergy.in"
          required
          autoFocus
          className="w-full border border-[#bab6b6] bg-white px-3.5 py-3 text-sm text-[#201e1d] outline-none transition-colors placeholder:text-[#9b9797] focus:border-[#1a1f3d]"
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
