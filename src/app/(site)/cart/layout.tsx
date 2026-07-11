import type { Metadata } from "next";

// cart/page.tsx is a client component, and Next.js only allows a `metadata`
// export from a server component — so it lives here instead. No unique
// public content (per-session cart state), so keep it out of the index.
export const metadata: Metadata = {
  title: "Your Cart",
  robots: { index: false, follow: false },
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
