import type { Metadata } from "next";

// checkout/page.tsx is a client component, and Next.js only allows a
// `metadata` export from a server component — so it lives here instead. No
// unique public content (per-session checkout state), so keep it out of the
// index — and never let a live cart/order flow show up in search results.
export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
