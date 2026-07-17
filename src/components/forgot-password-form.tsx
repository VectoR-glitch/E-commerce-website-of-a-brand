"use client";
import Link from "next/link";
import { useActionState } from "react";
import { forgotPasswordAction, type ForgotState } from "@/app/actions/password";

const field =
  "mt-2 w-full border border-line bg-white px-3.5 py-3 text-sm outline-none focus:border-forest";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<ForgotState, FormData>(
    forgotPasswordAction,
    undefined,
  );

  // Neutral confirmation — never reveals whether the email is registered.
  if (state?.ok) {
    return (
      <div role="status" className="mt-10 border border-forest/30 bg-forest/5 px-4 py-5 text-sm text-forest">
        If an account exists for that email, a password-reset link is on its way. It expires in 1 hour.
      </div>
    );
  }

  return (
    <form action={action} className="mt-10 space-y-5">
      <div>
        <label htmlFor="email" className="smallcaps text-brass-deep">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className={field} />
      </div>

      {state?.error && (
        <p role="alert" className="border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="smallcaps w-full bg-forest px-7 py-3 text-bone btn-fill-forest disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send reset link"}
      </button>

      <p className="text-center text-sm text-ink/60">
        <Link href="/login" className="text-forest hover:underline">Back to sign in</Link>
      </p>
    </form>
  );
}