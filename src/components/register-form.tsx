"use client";
import Link from "next/link";
import { useActionState } from "react";
import { registerAction, type RegisterState } from "@/app/actions/account";
import { PasswordInput } from "@/components/password-input";
import { INDIAN_STATES } from "@/lib/constants";

const field =
  "mt-2 w-full border border-line bg-white px-3.5 py-3 text-sm outline-none focus:border-forest";

export function RegisterForm({ referral }: { referral?: string }) {
  const [state, action, pending] = useActionState<RegisterState, FormData>(registerAction, undefined);

  return (
    <form action={action} className="mt-10 space-y-5">
      {referral && <input type="hidden" name="ref" value={referral} />}
      <div>
        <label htmlFor="name" className="smallcaps text-brass-deep">Name</label>
        <input id="name" name="name" type="text" autoComplete="name" required className={field} />
      </div>
      <div>
        <label htmlFor="email" className="smallcaps text-brass-deep">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className={field} />
      </div>
      <div>
        <label htmlFor="phone" className="smallcaps text-brass-deep">Mobile</label>
        <input
          id="phone"
          name="phone"
          inputMode="numeric"
          maxLength={10}
          autoComplete="tel-national"
          placeholder="10-digit mobile"
          required
          className={field}
        />
      </div>
      <div>
        <label htmlFor="line1" className="smallcaps text-brass-deep">Address line 1</label>
        <input
          id="line1"
          name="line1"
          autoComplete="address-line1"
          placeholder="House / flat no., street"
          required
          className={field}
        />
      </div>
      <div>
        <label htmlFor="line2" className="smallcaps text-brass-deep">Address line 2</label>
        <input
          id="line2"
          name="line2"
          autoComplete="address-line2"
          placeholder="Area, landmark (optional)"
          className={field}
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="city" className="smallcaps text-brass-deep">City / Town</label>
          <input id="city" name="city" autoComplete="address-level2" required className={field} />
        </div>
        <div>
          <label htmlFor="state" className="smallcaps text-brass-deep">State</label>
          <select id="state" name="state" defaultValue="" autoComplete="address-level1" required className={field}>
            <option value="" disabled>Select a state</option>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="pincode" className="smallcaps text-brass-deep">Pincode</label>
        <input
          id="pincode"
          name="pincode"
          inputMode="numeric"
          maxLength={6}
          autoComplete="postal-code"
          placeholder="6-digit pincode"
          required
          onInput={(e) => {
            e.currentTarget.value = e.currentTarget.value.replace(/\D/g, "").slice(0, 6);
          }}
          className={field}
        />
      </div>
      <div>
        <label htmlFor="password" className="smallcaps text-brass-deep">Password</label>
        <PasswordInput
          id="password"
          name="password"
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