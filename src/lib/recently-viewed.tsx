"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
} from "react";

// A recently-viewed product (product-level, not per-variant — you viewed the
// product, whatever fragrance was selected). Purely client-side (localStorage),
// like the guest wishlist — it's a browsing convenience, not account data, so it
// stays per-device with no server model. We keep a small display snapshot so the
// rail renders without a round-trip.
export type RecentItem = {
  slug: string;
  name: string;
  image?: string;
  fromPaise: number;
};

// How many to remember. Small on purpose — a rail, not a history log.
const MAX_RECENT = 8;
const STORAGE_KEY = "klenich.recentlyViewed.v1";

type State = { items: RecentItem[] };
type Action =
  | { type: "RECORD"; item: RecentItem }
  | { type: "HYDRATE"; state: State };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "RECORD": {
      // Move-to-front, dedupe by slug, cap the list.
      const rest = state.items.filter((i) => i.slug !== action.item.slug);
      return { items: [action.item, ...rest].slice(0, MAX_RECENT) };
    }
    case "HYDRATE":
      return action.state;
    default:
      return state;
  }
}

type RecentlyViewedContextValue = {
  items: RecentItem[];
  record: (item: RecentItem) => void;
};

const RecentlyViewedContext = createContext<RecentlyViewedContextValue | null>(null);

export function RecentlyViewedProvider({ children }: { children: React.ReactNode }) {
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

  const record = useCallback((item: RecentItem) => dispatch({ type: "RECORD", item }), []);

  return (
    <RecentlyViewedContext.Provider value={{ items: state.items, record }}>
      {children}
    </RecentlyViewedContext.Provider>
  );
}

export function useRecentlyViewed() {
  const ctx = useContext(RecentlyViewedContext);
  if (!ctx) throw new Error("useRecentlyViewed must be used within RecentlyViewedProvider");
  return ctx;
}
