"use client";
import { useActionState } from "react";
import { saveAddressAction, type AddressState } from "@/app/actions/account";
import { INDIAN_STATES } from "@/lib/constants";

const field =
  "mt-2 w-full border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-forest";

export type AddressValues = {
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
};

export function AddressForm({ address }: { address: AddressValues }) {
  const [state, action, pending] = useActionState<AddressState, FormData>(
    saveAddressAction,
    undefined,
  );

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="line1" className="smallcaps text-brass-deep">Address line 1</label>
        <input
          id="line1"
          name="line1"
          defaultValue={address.line1}
          required
          placeholder="House / flat no., street"
          className={field}
        />
      </div>
      <div>
        <label htmlFor="line2" className="smallcaps text-brass-deep">Address line 2</label>
        <input
          id="line2"
          name="line2"
          defaultValue={address.line2}
          placeholder="Area, landmark (optional)"
          className={field}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="city" className="smallcaps text-brass-deep">City / Town</label>
          <input id="city" name="city" defaultValue={address.city} required className={field} />
        </div>
        <div>
          <label htmlFor="state" className="smallcaps text-brass-deep">State</label>
          <select id="state" name="state" defaultValue={address.state} required className={field}>
            <option value="" disabled>Select a state</option>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="pincode" className="smallcaps text-brass-deep">Pincode</label>
          <input
            id="pincode"
            name="pincode"
            defaultValue={address.pincode}
            inputMode="numeric"
            maxLength={6}
            required
            placeholder="6-digit pincode"
            onInput={(e) => {
              e.currentTarget.value = e.currentTarget.value.replace(/\D/g, "").slice(0, 6);
            }}
            className={field}
          />
        </div>
        <div>
          <label htmlFor="phone" className="smallcaps text-brass-deep">Contact mobile</label>
          <input
            id="phone"
            name="phone"
            defaultValue={address.phone}
            inputMode="numeric"
            placeholder="10-digit mobile (optional)"
            className={field}
          />
        </div>
      </div>

      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p role="status" className="text-sm text-forest">Address saved.</p>}

      <button
        type="submit"
        disabled={pending}
        className="smallcaps bg-forest px-6 py-2.5 text-bone btn-fill-forest disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save address"}
      </button>
    </form>
  );
}