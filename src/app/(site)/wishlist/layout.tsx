import type { Metadata } from "next";

// wishlist/page.tsx is a client component, and Next.js only allows a
// `metadata` export from a server component — so it lives here instead. No
// unique public content (personal, per-customer), so keep it out of the index.
export const metadata: Metadata = {
  title: "Wishlist",
  robots: { index: false, follow: false },
};

export default function WishlistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
