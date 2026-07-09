import type { Metadata } from "next";

// Every page under /account/* is personal, authenticated content with no
// unique public SEO value — noindex the whole subtree in one place rather
// than repeating this on every subpage (orders, security, subscriptions,
// loyalty, ...). Child pages can still set their own `title`; this only
// supplies `robots`, which they inherit unless they override it.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}
