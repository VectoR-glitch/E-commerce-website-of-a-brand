"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { MAX_QTY_PER_ITEM } from "@/lib/constants";
import { persistCart, syncGuestCart } from "@/app/actions/cart";

export type CartItem = {
  /**
   * Stable variant id (Postgres cuid) — the cart's identity key. SKU is a
   * mutable human label, so keying on it would orphan an item the moment an
   * admin re-labels the SKU; keying on the immutable id keeps carts intact.
   */
  variantId: string;
  sku: string; // display-only snapshot of the SKU at add-to-cart time
  productSlug: string;
  name: string;
  fragrance?: string;
  size: string;
  image?: string; // resolved product photo for the chosen fragrance+size
  pricePaise: number; // display price; re-validated against Postgres at checkout
  quantity: number;
};

type CartState = { items: CartItem[] };

type CartAction =
  | { type: "ADD"; item: Omit<CartItem, "quantity">; quantity?: number }
  | { type: "SET_QTY"; variantId: string; quantity: number }
  | { type: "REMOVE"; variantId: string }
  | { type: "CLEAR" }
  | { type: "HYDRATE"; state: CartState };

// v2: cart items are now keyed by variantId (was sku in v1). Bumping the key
// drops any stale v1 cart cleanly rather than half-migrating its shape.
const STORAGE_KEY = "klenich.cart.v2";

// Hard cap per line item — enforced HERE in the reducer so every path (+/−
// buttons, manual entry, repeated add-to-cart) is bound by it, with no UI
// workaround. Real stock is still re-validated server-side at checkout, and
// the server independently re-enforces this same cap (canonical value lives in
// constants.ts so both sides share one source of truth). Re-exported here so
// existing client consumers (cart, quantity-stepper) keep their import path.
export { MAX_QTY_PER_ITEM };

function reducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD": {
      const qty = action.quantity ?? 1;
      const existing = state.items.find((i) => i.variantId === action.item.variantId);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.variantId === action.item.variantId
              ? {
                  ...i,
                  quantity: Math.min(i.quantity + qty, MAX_QTY_PER_ITEM),
                }
              : i,
          ),
        };
      }
      return {
        items: [
          ...state.items,
          { ...action.item, quantity: Math.min(qty, MAX_QTY_PER_ITEM) },
        ],
      };
    }
    case "SET_QTY": {
      if (action.quantity <= 0) {
        return { items: state.items.filter((i) => i.variantId !== action.variantId) };
      }
      const quantity = Math.min(action.quantity, MAX_QTY_PER_ITEM);
      return {
        items: state.items.map((i) =>
          i.variantId === action.variantId ? { ...i, quantity } : i,
        ),
      };
    }
    case "REMOVE":
      return { items: state.items.filter((i) => i.variantId !== action.variantId) };
    case "CLEAR":
      return { items: [] };
    case "HYDRATE":
      return action.state;
    default:
      return state;
  }
}

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotalPaise: number;
  /** true when a customer is signed in — lets the UI prompt guests to log in */
  authenticated: boolean;
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({
  children,
  authenticated = false,
  initialItems = [],
}: {
  children: React.ReactNode;
  /** true when a customer is signed in — the server cart is then authoritative */
  authenticated?: boolean;
  /** the signed-in customer's server cart, hydrated on the server */
  initialItems?: CartItem[];
}) {
  // Signed in → seed from the server cart; guest → empty until localStorage loads.
  const [state, dispatch] = useReducer(reducer, {
    items: authenticated ? initialItems : [],
  });
  // Gates server write-through until the initial login merge/load has completed,
  // so we never clobber the server cart with a half-initialized client state.
  const [synced, setSynced] = useState(false);
  // True once the user actually changes the cart — so the initial server-seed /
  // login-merge doesn't trigger a redundant write-back on every page load.
  const dirty = useRef(false);
  // Always-current state, readable from inside the merge effect below without
  // retriggering it — lets the merge tell whether the user changed the cart
  // while the merge request was in flight.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Guest: reconcile the cart to localStorage. Runs on mount AND whenever we
  // become a guest — including right after logout, when this provider (it lives
  // in a persistent layout) keeps the previous session's in-memory items. Always
  // adopt localStorage (empty → clear), so logging out empties the cart rather
  // than leaving the signed-in items behind. The account's cart lives on the
  // server and is restored on next login.
  useEffect(() => {
    if (authenticated) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      dispatch({ type: "HYDRATE", state: raw ? JSON.parse(raw) : { items: [] } });
    } catch {
      dispatch({ type: "HYDRATE", state: { items: [] } });
    }
  }, [authenticated]);

  // Signed in: one-time — merge any leftover guest cart into the server cart,
  // adopt the (authoritative) result, and clear the guest storage.
  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;
    (async () => {
      // Guard the read-clear-merge sequence with a cross-tab lock: two tabs
      // open at login both race this effect, and each independently reads its
      // own snapshot of the SAME localStorage guest cart before either clears
      // it. Without serializing them, both can call syncGuestCart with the
      // same guest quantities — the second call reads the server cart AFTER
      // the first's merge already landed, then adds the guest quantity again
      // on top, doubling it. Locking makes the second tab's localStorage read
      // happen only after the first tab's removeItem has completed, so it
      // sees nothing left to merge. Falls back to unlocked (rare browsers
      // without the Web Locks API) rather than breaking the merge outright.
      const run = async () => {
        let guest: { variantId: string; quantity: number }[] = [];
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw) as CartState;
            guest = (parsed.items ?? []).map((i) => ({ variantId: i.variantId, quantity: i.quantity }));
          }
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          // ignore corrupt storage
        }
        // Snapshotted right before the merge request goes out, so we can tell
        // afterward whether the user changed the cart (e.g. clicked "Add to
        // cart" on the page they were redirected to) while it was in flight —
        // blindly overwriting with the server's result would silently discard
        // that action.
        const preMergeItems = stateRef.current.items;
        if (guest.length) {
          try {
            const merged = await syncGuestCart(guest);
            if (!cancelled) {
              const latest = stateRef.current.items;
              if (latest === preMergeItems) {
                // Nothing changed while the merge was in flight.
                dispatch({ type: "HYDRATE", state: { items: merged } });
              } else {
                // Reconcile by DELTA, not by absolute value: for each variant,
                // however much the user's local quantity moved during the
                // merge window (latest − preMerge) is applied on top of the
                // server's authoritative merged quantity. This matters
                // specifically when the touched variant was ALSO part of the
                // guest cart just merged in — e.g. guest cart had 2 of a
                // variant, merged becomes 2, and the user adds 1 more of that
                // SAME variant mid-merge (so it looks "new" locally, absent
                // from preMergeItems). Overwriting with the local value would
                // silently drop the guest's 2 down to 1; applying the delta
                // (+1) on top of merged's 2 correctly yields 3.
                const mergedByVariant = new Map(merged.map((i) => [i.variantId, i]));
                const preByVariant = new Map(preMergeItems.map((i) => [i.variantId, i.quantity]));
                const latestByVariant = new Map(latest.map((i) => [i.variantId, i]));
                const allIds = new Set([
                  ...mergedByVariant.keys(),
                  ...preByVariant.keys(),
                  ...latestByVariant.keys(),
                ]);
                const reconciled: CartItem[] = [];
                for (const id of allIds) {
                  const mergedItem = mergedByVariant.get(id);
                  const localItem = latestByVariant.get(id);
                  const delta = (localItem?.quantity ?? 0) - (preByVariant.get(id) ?? 0);
                  const quantity = Math.min(
                    MAX_QTY_PER_ITEM,
                    Math.max(0, (mergedItem?.quantity ?? 0) + delta),
                  );
                  if (quantity <= 0) continue;
                  const base = mergedItem ?? localItem;
                  if (base) reconciled.push({ ...base, quantity });
                }
                dispatch({ type: "HYDRATE", state: { items: reconciled } });
              }
            }
          } catch {
            // keep the server-seeded state on failure
          }
        }
        if (!cancelled) setSynced(true);
      };

      if (typeof navigator !== "undefined" && navigator.locks) {
        await navigator.locks.request("klenich-cart-merge", run);
      } else {
        await run();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated]);

  // Persist on change: localStorage for guests; write-through to the server
  // (debounced) for signed-in customers, once the initial sync has run.
  useEffect(() => {
    if (!authenticated) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // ignore quota errors
      }
      return;
    }
    if (!synced || !dirty.current) return;
    const t = setTimeout(() => {
      persistCart(state.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity }))).catch(() => {});
    }, 500);
    return () => clearTimeout(t);
  }, [state, authenticated, synced]);

  // The debounce above means a change made right before a tab close/switch
  // can be lost — neither the server write nor (for signed-in customers) any
  // local fallback has happened yet. Flush immediately when the tab is about
  // to go away, using stateRef so this always sends the latest state
  // regardless of when the listener was attached.
  useEffect(() => {
    if (!authenticated) return;
    const flush = () => {
      if (synced && dirty.current) {
        persistCart(
          stateRef.current.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        ).catch(() => {});
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
    };
  }, [authenticated, synced]);

  const value = useMemo<CartContextValue>(() => {
    const count = state.items.reduce((n, i) => n + i.quantity, 0);
    const subtotalPaise = state.items.reduce(
      (sum, i) => sum + i.pricePaise * i.quantity,
      0,
    );
    return {
      items: state.items,
      count,
      subtotalPaise,
      authenticated,
      addItem: (item, quantity) => {
        dirty.current = true;
        dispatch({ type: "ADD", item, quantity });
      },
      setQuantity: (variantId, quantity) => {
        dirty.current = true;
        dispatch({ type: "SET_QTY", variantId, quantity });
      },
      removeItem: (variantId) => {
        dirty.current = true;
        dispatch({ type: "REMOVE", variantId });
      },
      clear: () => {
        dirty.current = true;
        dispatch({ type: "CLEAR" });
      },
    };
  }, [state, authenticated]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}