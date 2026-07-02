"use client";
import { useActionState } from "react";
import { updateProfileAction, type ProfileState } from "@/app/actions/account";

const field =
  "mt-2 w-full border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-forest";

export function ProfileForm({ name, phone, email }: { name: string; phone: string; email: string }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(
    updateProfileAction,
    undefined,
  );

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="name" className="smallcaps text-brass-deep">Name</label>
        <input id="name" name="name" defaultValue={name} required className={field} />
      </div>
      <div>
        <label className="smallcaps text-brass-deep">Email</label>
        <input value={email} disabled className={`${field} bg-bone/50 text-ink/50`} />
        <p className="mt-1 text-xs text-ink/45">Email is your login and can&rsquo;t be changed here.</p>
      </div>
      <div>
        <label htmlFor="phone" className="smallcaps text-brass-deep">Mobile</label>
        <input
          id="phone"
          name="phone"
          defaultValue={phone}
          inputMode="numeric"
          placeholder="10-digit mobile"
          className={field}
        />
      </div>

      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="text-sm text-forest">Saved.</p>}

      <button
        type="submit"
        disabled={pending}
        className="smallcaps bg-forest px-6 py-2.5 text-bone btn-fill-forest disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}