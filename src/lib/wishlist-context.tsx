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
import { persistWishlist, syncGuestWishlist } from "@/app/actions/wishlist";

// A saved product (optionally scoped to a fragrance). We keep a small display
// snapshot so the /wishlist page renders without a round-trip; the card links to
// the product for live price/stock. Guests persist to localStorage; on login the
// guest set merges into the customer's server rows, which then become
// authoritative and sync across devices (same pattern as the cart).
export type WishlistItem = {
  slug: string;
  fragrance?: string;
  name: string;
  image?: string;
  fromPaise: number; // "from" price at save time (display only)
};

// Identity key — a product+fragrance pair, so Floor Cleaner Lavender and
// Lemongrass can both be saved independently.
export const wishlistKey = (slug: string, fragrance?: string) =>
  `${slug}|${fragrance ?? ""}`;

type State = { items: WishlistItem[] };
type Action =
  | { type: "TOGGLE"; item: WishlistItem }
  | { type: "REMOVE"; key: string }
  | { type: "CLEAR" }
  | { type: "HYDRATE"; state: State };

const STORAGE_KEY = "klenich.wishlist.v1";

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "TOGGLE": {
      const key = wishlistKey(action.item.slug, action.item.fragrance);
      const exists = state.items.some((i) => wishlistKey(i.slug, i.fragrance) === key);
      return exists
        ? { items: state.items.filter((i) => wishlistKey(i.slug, i.fragrance) !== key) }
        : { items: [action.item, ...state.items] };
    }
    case "REMOVE":
      return { items: state.items.filter((i) => wishlistKey(i.slug, i.fragrance) !== action.key) };
    case "CLEAR":
      return { items: [] };
    case "HYDRATE":
      return action.state;
    default:
      return state;
  }
}

// Only the identity travels to the server; display fields are re-hydrated there.
const toWire = (items: WishlistItem[]) => items.map((i) => ({ slug: i.slug, fragrance: i.fragrance }));

type WishlistContextValue = {
  items: WishlistItem[];
  count: number;
  has: (slug: string, fragrance?: string) => boolean;
  toggle: (item: WishlistItem) => void;
  remove: (key: string) => void;
  clear: () => void;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({
  children,
  authenticated = false,
  initialItems = [],
}: {
  children: React.ReactNode;
  /** true when a customer is signed in — their server wishlist is authoritative */
  authenticated?: boolean;
  /** the signed-in customer's server wishlist, hydrated on the server */
  initialItems?: WishlistItem[];
}) {
  // Signed in → seed from the server rows; guest → empty until localStorage loads.
  const [state, dispatch] = useReducer(reducer, {
    items: authenticated ? initialItems : [],
  });
  // Gates server write-through until the initial login merge/load has completed,
  // so we never clobber the server wishlist with a half-initialized client state.
  const [synced, setSynced] = useState(false);
  // True once the user actually changes the wishlist — so the initial
  // server-seed / login-merge doesn't trigger a redundant write-back on load.
  const dirty = useRef(false);

  // Guest: reconcile to localStorage. Runs on mount AND whenever we become a
  // guest — including right after logout, when this provider (it lives in a
  // persistent layout) still holds the previous session's in-memory items.
  // Always adopt localStorage (empty → clear) so logging out drops the account's
  // saved items from view; they're safe on the server and restore on next login.
  useEffect(() => {
    if (authenticated) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      dispatch({ type: "HYDRATE", state: raw ? JSON.parse(raw) : { items: [] } });
    } catch {
      dispatch({ type: "HYDRATE", state: { items: [] } });
    }
  }, [authenticated]);

  // Signed in: one-time — merge any leftover guest wishlist into the server set,
  // adopt the (authoritative) hydrated result, and clear the guest storage.
  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;
    (async () => {
      let guest: { slug: string; fragrance?: string }[] = [];
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as State;
          guest = (parsed.items ?? []).map((i) => ({ slug: i.slug, fragrance: i.fragrance }));
        }
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore corrupt storage
      }
      if (guest.length) {
        try {
          const merged = await syncGuestWishlist(guest);
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
      persistWishlist(toWire(state.items)).catch(() => {});
    }, 500);
    return () => clearTimeout(t);
  }, [state, authenticated, synced]);

  const value = useMemo<WishlistContextValue>(() => {
    const keys = new Set(state.items.map((i) => wishlistKey(i.slug, i.fragrance)));
    return {
      items: state.items,
      count: state.items.length,
      has: (slug, fragrance) => keys.has(wishlistKey(slug, fragrance)),
      toggle: (item) => {
        dirty.current = true;
        dispatch({ type: "TOGGLE", item });
      },
      remove: (key) => {
        dirty.current = true;
        dispatch({ type: "REMOVE", key });
      },
      clear: () => {
        dirty.current = true;
        dispatch({ type: "CLEAR" });
      },
    };
  }, [state]);

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
}
