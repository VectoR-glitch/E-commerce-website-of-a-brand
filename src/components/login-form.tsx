"use client";
import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { loginAction, type LoginState } from "@/app/actions/auth";
import { resendVerificationAction, type ResendState } from "@/app/actions/account";
import { PasswordInput } from "@/components/password-input";

const field =
  "mt-2 w-full border border-line bg-white px-3.5 py-3 text-sm outline-none focus:border-forest";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, undefined);
  const [resend, resendAction, resending] = useActionState<ResendState, FormData>(
    resendVerificationAction,
    undefined,
  );

  // Start every visit with empty credentials. Browsers otherwise repopulate
  // these from form-history or the back/forward cache (bfcache) — so a previous
  // session's email/password can linger after logout. Clear on mount and again
  // when the page is restored from bfcache (which doesn't remount React).
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const clear = () => {
      const f = formRef.current;
      const email = f?.elements.namedItem("email") as HTMLInputElement | null;
      const password = f?.elements.namedItem("password") as HTMLInputElement | null;
      if (email) email.value = "";
      if (password) password.value = "";
    };
    clear();
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) clear();
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  return (
    <>
      <form ref={formRef} action={action} autoComplete="off" className="mt-10 space-y-5">
        <input type="hidden" name="next" value={next} />
        <div>
          <label htmlFor="email" className="smallcaps text-brass-deep">Email</label>
          <input id="email" name="email" type="email" autoComplete="off" required className={field} />
        </div>
        <div>
          <label htmlFor="password" className="smallcaps text-brass-deep">Password</label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="off"
            required
            className={field}
          />
        </div>

        {state?.error && (
          <p className="border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            {state.error}
          </p>
        )}

        <div className="text-right">
          <Link href="/forgot-password" className="text-sm text-ink/55 hover:text-forest">
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="smallcaps w-full bg-forest px-7 py-3 text-bone btn-fill-forest disabled:opacity-60"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      {/* Separate, sibling form (nesting <form>s is invalid HTML) — offers a
          one-click resend of the verification email for an unconfirmed account,
          reusing the email the login attempt was for. */}
      {state?.unverified && state.email && (
        <form action={resendAction} className="mt-4 text-center">
          <input type="hidden" name="email" value={state.email} />
          {resend?.ok ? (
            <p className="text-sm text-forest">Verification email sent — check your inbox.</p>
          ) : (
            <button
              type="submit"
              disabled={resending}
              className="text-sm font-medium text-forest underline disabled:opacity-60"
            >
              {resending ? "Sending…" : "Resend verification email"}
            </button>
          )}
        </form>
      )}
    </>
  );
}