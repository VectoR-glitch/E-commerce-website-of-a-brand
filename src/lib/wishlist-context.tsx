"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";

// A saved product (optionally scoped to a fragrance). We keep a small display
// snapshot so the /wishlist page renders without a round-trip; the card links to
// the product for live price/stock. Kept purely client-side (localStorage) like
// the guest cart — no login required, no server model. Cross-device sync is a
// later upgrade (mirror to a Wishlist table on login, same as the cart).
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

type WishlistContextValue = {
  items: WishlistItem[];
  count: number;
  has: (slug: string, fragrance?: string) => boolean;
  toggle: (item: WishlistItem) => void;
  remove: (key: string) => void;
  clear: () => void;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { items: [] });

  // Load from localStorage on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) dispatch({ type: "HYDRATE", state: JSON.parse(raw) as State });
    } catch {
      // ignore corrupt storage
    }
  }, []);

  // Persist on change.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore quota errors
    }
  }, [state]);

  const value = useMemo<WishlistContextValue>(() => {
    const keys = new Set(state.items.map((i) => wishlistKey(i.slug, i.fragrance)));
    return {
      items: state.items,
      count: state.items.length,
      has: (slug, fragrance) => keys.has(wishlistKey(slug, fragrance)),
      toggle: (item) => dispatch({ type: "TOGGLE", item }),
      remove: (key) => dispatch({ type: "REMOVE", key }),
      clear: () => dispatch({ type: "CLEAR" }),
    };
  }, [state]);

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
}
