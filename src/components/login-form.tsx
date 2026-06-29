"use client";
import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/actions/auth";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    loginAction,
    undefined,
  );

  return (
    <form action={action} className="mt-10 space-y-5">
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="email" className="smallcaps text-brass-deep">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-2 w-full border border-line bg-white px-3.5 py-3 text-sm outline-none focus:border-forest"
        />
      </div>
      <div>
        <label htmlFor="password" className="smallcaps text-brass-deep">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-2 w-full border border-line bg-white px-3.5 py-3 text-sm outline-none focus:border-forest"
        />
      </div>

      {state?.error && (
        <p className="border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="smallcaps w-full bg-forest px-7 py-3 text-bone btn-fill-forest disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}