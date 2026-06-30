"use client";
import { useActionState } from "react";
import { updateVariantSku, type SkuUpdateState } from "@/app/admin/actions";

const field =
  "border border-line bg-white px-2.5 py-1.5 text-sm font-mono outline-none focus:border-forest";

/**
 * Gated SKU editor. SKU is the identity key used by the cart and checkout, so
 * the edit is deliberately high-friction: it lives behind a disclosure, the new
 * value must be typed twice, an acknowledgment must be ticked, and a final
 * confirm() dialog stands between the click and the submit. The server action
 * re-validates all of this — this component is just the friendly front door.
 */
export function SkuEditor({ variantId, currentSku }: { variantId: string; currentSku: string }) {
  const [state, action, pending] = useActionState<SkuUpdateState, FormData>(
    updateVariantSku,
    {},
  );

  return (
    <details className="mt-3 border-t border-line/70 pt-3">
      <summary className="smallcaps cursor-pointer text-ink/55 hover:text-forest">
        Change SKU
      </summary>
      <form
        action={action}
        onSubmit={(e) => {
          // Client-side double-check before the action fires. The server still
          // enforces both of these — this is just to fail fast and to make the
          // change explicit ("verify doubly").
          const fd = new FormData(e.currentTarget);
          const next = String(fd.get("newSku") ?? "").trim();
          const confirmNext = String(fd.get("confirmSku") ?? "").trim();
          if (next !== confirmNext) {
            e.preventDefault();
            window.alert("The two SKU entries don't match.");
            return;
          }
          if (
            !window.confirm(
              `Change SKU from "${currentSku}" to "${next}"?\n\n` +
                "Customer carts still holding the old SKU may fail at checkout until re-added. " +
                "Past orders are unaffected.",
            )
          ) {
            e.preventDefault();
          }
        }}
        className="mt-3 space-y-2"
      >
        <input type="hidden" name="variantId" value={variantId} />
        <p className="text-xs text-ink/55">
          Current SKU <span className="font-mono text-ink">{currentSku}</span>. Changing it can
          break customer carts that still hold the old SKU; past orders keep their original SKU.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            name="newSku"
            placeholder="New SKU"
            required
            pattern="[A-Za-z0-9-]{1,32}"
            autoComplete="off"
            className={`${field} w-32`}
            aria-label="New SKU"
          />
          <input
            name="confirmSku"
            placeholder="Re-enter new SKU"
            required
            pattern="[A-Za-z0-9-]{1,32}"
            autoComplete="off"
            className={`${field} w-36`}
            aria-label="Re-enter new SKU"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-ink/70">
          <input type="checkbox" name="ack" required />
          I understand this changes the product identifier used across the catalog.
        </label>

        {state?.error && (
          <p className="border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
            {state.error}
          </p>
        )}
        {state?.ok && (
          <p className="border border-forest/30 bg-forest/5 px-2.5 py-1.5 text-xs text-forest">
            SKU updated.
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="smallcaps border border-line px-4 py-1.5 text-ink/70 hover:border-forest hover:text-forest disabled:opacity-60"
        >
          {pending ? "Updating…" : "Update SKU"}
        </button>
      </form>
    </details>
  );
}