"use client";
import { useActionState } from "react";
import { resetPasswordAction, type ResetState } from "@/app/actions/password";

const field =
  "mt-2 w-full border border-line bg-white px-3.5 py-3 text-sm outline-none focus:border-forest";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<ResetState, FormData>(
    resetPasswordAction,
    undefined,
  );

  return (
    <form action={action} className="mt-10 space-y-5">
      <input type="hidden" name="token" value={token} />
      <div>
        <label htmlFor="newPassword" className="smallcaps text-brass-deep">New password</label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className={field}
        />
        <p className="mt-1 text-xs text-ink/45">At least 8 characters.</p>
      </div>
      <div>
        <label htmlFor="confirmPassword" className="smallcaps text-brass-deep">Confirm new password</label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className={field}
        />
      </div>

      {state?.error && (
        <p className="border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="smallcaps w-full bg-forest px-7 py-3 text-bone btn-fill-forest disabled:opacity-60"
      >
        {pending ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}