// Pure reconciliation logic for the guest-cart login merge, split out of
// cart-context.tsx so it's independently testable — a purely functional
// question about how three item lists combine, no React/DOM involved.
import { MAX_QTY_PER_ITEM } from "@/lib/constants";

export type ReconcileItem = { variantId: string; quantity: number };

/**
 * Combines the server's authoritative post-merge cart with whatever the user
 * did locally while the merge request was in flight.
 *
 * Two passes, because "touched during the window" and "explicitly removed
 * during the window" need different rules — collapsing them into one delta
 * formula can resurrect an explicit removal (see pass 2's comment).
 *
 * - `merged`: the server's result after combining the guest cart into the
 *   existing server cart (or, if there was nothing to merge, just the current
 *   server cart re-read fresh).
 * - `preMergeItems`: the local cart state snapshotted right before the merge
 *   request went out.
 * - `latest`: the local cart state at the moment the merge request resolved.
 */
export function reconcileCartMerge<T extends ReconcileItem>(
  merged: T[],
  preMergeItems: T[],
  latest: T[],
): T[] {
  const mergedByVariant = new Map(merged.map((i) => [i.variantId, i]));
  const preByVariant = new Map(preMergeItems.map((i) => [i.variantId, i.quantity]));
  const latestByVariant = new Map(latest.map((i) => [i.variantId, i]));
  const resultByVariant = new Map(mergedByVariant);

  // Pass 1 — apply LOCAL quantity changes as a delta on top of the server's
  // authoritative merged quantity. This matters when the touched variant was
  // ALSO part of the guest cart just merged in — e.g. guest cart had 2 of a
  // variant, merged becomes 2, and the user adds 1 more of that SAME variant
  // mid-merge (so it looks "new" locally, absent from preMergeItems).
  // Overwriting with the local value would silently drop the guest's 2 down
  // to 1; applying the delta (+1) on top of merged's 2 correctly yields 3.
  for (const [id, item] of latestByVariant) {
    const preQty = preByVariant.get(id) ?? 0;
    if (item.quantity === preQty) continue; // untouched during the window
    const delta = item.quantity - preQty;
    const mergedQty = mergedByVariant.get(id)?.quantity ?? 0;
    const quantity = Math.min(MAX_QTY_PER_ITEM, Math.max(0, mergedQty + delta));
    if (quantity <= 0) resultByVariant.delete(id);
    else resultByVariant.set(id, { ...(mergedByVariant.get(id) ?? item), quantity });
  }

  // Pass 2 — an explicit removal during the window always wins, regardless
  // of the merged value: the user took a deliberate action to remove the
  // line, so honor it even if the guest cart also contributed units to that
  // same variant (a delta alone can under-remove when merged > preMerge for
  // that id).
  for (const id of preByVariant.keys()) {
    if (!latestByVariant.has(id)) resultByVariant.delete(id);
  }

  return [...resultByVariant.values()];
}
