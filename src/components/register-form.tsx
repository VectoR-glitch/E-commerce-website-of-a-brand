"use client";
import Link from "next/link";
import { useActionState } from "react";
import { registerAction, type RegisterState } from "@/app/actions/account";

const field =
  "mt-2 w-full border border-line bg-white px-3.5 py-3 text-sm outline-none focus:border-forest";

export function RegisterForm() {
  const [state, action, pending] = useActionState<RegisterState, FormData>(registerAction, undefined);

  return (
    <form action={action} className="mt-10 space-y-5">
      <div>
        <label htmlFor="name" className="smallcaps text-brass-deep">Name</label>
        <input id="name" name="name" type="text" autoComplete="name" required className={field} />
      </div>
      <div>
        <label htmlFor="email" className="smallcaps text-brass-deep">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className={field} />
      </div>
      <div>
        <label htmlFor="password" className="smallcaps text-brass-deep">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className={field}
        />
        <p className="mt-1.5 text-xs text-ink/50">At least 8 characters.</p>
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
        {pending ? "Creating account…" : "Create account"}
      </button>

      <p className="text-center text-sm text-ink/60">
        Already have an account?{" "}
        <Link href="/login" className="text-forest hover:underline">Sign in</Link>
      </p>
    </form>
  );
}