"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signIn, type LoginState } from "./actions";

const labelClass =
  "font-code text-[11px] uppercase tracking-[0.1em] text-[#444141]";

const fieldClass =
  "w-full border border-[#bab6b6] bg-white px-3.5 py-3 text-sm text-[#201e1d] outline-none transition-colors placeholder:text-[#9b9797] focus:border-[#1a1f3d]";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="font-display flex w-full items-center justify-between bg-[#1a1f3d] px-[18px] py-[15px] text-sm font-bold text-[#f3f2f2] transition-colors hover:bg-[#2b3358] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a1f3d] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="whitespace-nowrap">{pending ? "Signing in…" : "Sign in"}</span>
      <span aria-hidden="true" className="text-[#f0a422]">
        →
      </span>
    </button>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState<LoginState, FormData>(signIn, { error: null });

  return (
    <form action={formAction}>
      <input type="hidden" name="next" value={next} />

      <label className="mb-[18px] flex flex-col gap-[7px]">
        <span className={labelClass}>Work email</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          placeholder="name@tscertify.org"
          required
          autoFocus
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-[7px]">
        <span className={labelClass}>Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          required
          className={fieldClass}
        />
      </label>

      <div className="mt-3 flex items-center justify-between gap-4">
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[#605d5d]">
          <input
            type="checkbox"
            name="remember"
            className="h-[15px] w-[15px] accent-[#1a1f3d]"
          />
          <span className="whitespace-nowrap">Keep me signed in</span>
        </label>
        <a
          href="https://tech-synergy.in/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[13px] whitespace-nowrap text-[#1a1f3d] underline underline-offset-[3px] hover:text-[#3d4780]"
        >
          Forgot password?
        </a>
      </div>

      {state.error ? (
        <p
          role="alert"
          className="mt-[18px] border-l-2 border-[#ec3013] bg-[#ffe0d9] px-3.5 py-2.5 text-sm text-[#7c1405]"
        >
          {state.error}
        </p>
      ) : null}

      <div className="mt-[26px]">
        <SubmitButton />
      </div>
    </form>
  );
}
