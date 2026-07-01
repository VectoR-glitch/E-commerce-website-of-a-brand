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

  // Guest: hydrate from localStorage on mount.
  useEffect(() => {
    if (authenticated) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) dispatch({ type: "HYDRATE", state: JSON.parse(raw) });
    } catch {
      // ignore corrupt storage
    }
  }, [authenticated]);

  // Signed in: one-time — merge any leftover guest cart into the server cart,
  // adopt the (authoritative) result, and clear the guest storage.
  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;
    (async () => {
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
      if (guest.length) {
        try {
          const merged = await syncGuestCart(guest);
          if (!cancelled) dispatch({ type: "HYDRATE", state: { items: merged } });
        } catch {
          // keep the server-seeded state on failure
        }
      }
      if (!cancelled) setSynced(true);
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