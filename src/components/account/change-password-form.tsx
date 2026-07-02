"use client";
import { useActionState } from "react";
import { changePasswordAction, type ChangePasswordState } from "@/app/actions/password";
import { PasswordInput } from "@/components/password-input";

const field =
  "mt-2 w-full border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-forest";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<ChangePasswordState, FormData>(
    changePasswordAction,
    undefined,
  );

  // Remount inputs after a successful save so the fields clear (React 19 keeps
  // uncontrolled fields otherwise).
  const key = state?.ok ? "saved" : "editing";

  return (
    <form action={action} key={key} className="space-y-4">
      <div>
        <label htmlFor="currentPassword" className="smallcaps text-brass-deep">Current password</label>
        <PasswordInput
          id="currentPassword"
          name="currentPassword"
          autoComplete="current-password"
          required
          className={field}
        />
      </div>
      <div>
        <label htmlFor="newPassword" className="smallcaps text-brass-deep">New password</label>
        <PasswordInput
          id="newPassword"
          name="newPassword"
          autoComplete="new-password"
          required
          minLength={8}
          className={field}
        />
        <p className="mt-1 text-xs text-ink/45">At least 8 characters.</p>
      </div>
      <div>
        <label htmlFor="confirmPassword" className="smallcaps text-brass-deep">Confirm new password</label>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          required
          minLength={8}
          className={field}
        />
      </div>

      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="text-sm text-forest">Password updated.</p>}

      <button
        type="submit"
        disabled={pending}
        className="smallcaps bg-forest px-6 py-2.5 text-bone btn-fill-forest disabled:opacity-60"
      >
        {pending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}