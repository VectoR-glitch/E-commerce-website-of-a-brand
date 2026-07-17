import Link from "next/link";
import Image from "next/image";
import { Ornament } from "@/components/ornament";

// This component is also used from error.tsx (a Client Component boundary),
// so it can't import gst.ts's toIST (marked "server-only") — same fixed IST
// shift + UTC-getter technique, inlined instead.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export type FooterShopLink = { href: string; label: string };

// Static fallback — used when no live shopLinks prop is passed (the root
// error/not-found boundaries render SiteFooter without a Server Component
// ancestor to fetch from, and shouldn't add a DB dependency to an
// already-degraded page anyway). The real (site) layout passes live,
// active-only links via getFooterShopLinks() below, so a product an admin
// deactivates drops out of the footer there instead of leaving a dead link.
const FALLBACK_SHOP_LINKS: FooterShopLink[] = [
  { href: "/product/dishwash-gel-lime", label: "Dishwash Gel" },
  { href: "/product/floor-cleaner", label: "Floor Cleaner" },
  { href: "/product/toilet-cleaner", label: "Toilet Cleaner" },
];

const otherColumns = [
  {
    title: "Company",
    links: [
      { href: "/why-klenich", label: "Why Klenich" },
      { href: "/our-story", label: "Our Story" },
      { href: "/blog", label: "Journal" },
    ],
  },
  {
    title: "Help",
    links: [
      { href: "/help", label: "FAQs" },
      { href: "/track-order", label: "Track Order" },
      { href: "/shipping-returns", label: "Shipping & Returns" },
      { href: "/contact", label: "Contact" },
    ],
  },
];

export function SiteFooter({ shopLinks = FALLBACK_SHOP_LINKS }: { shopLinks?: FooterShopLink[] }) {
  const columns = [{ title: "Shop", links: shopLinks }, ...otherColumns];
  // Computed once per render, not memoized — this component isn't
  // re-rendered on a timer, so a stale year until next render is fine.
  // eslint-disable-next-line react-hooks/purity
  const copyrightYear = new Date(Date.now() + IST_OFFSET_MS).getUTCFullYear();

  return (
    <footer className="border-t border-line bg-bone">
      <Ornament className="pt-12" />
      <div className="mx-auto grid max-w-6xl gap-10 px-8 pt-10 pb-16 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <Image
            src="/brand/klenich-final.png"
            alt="Klenich"
            width={901}
            height={374}
            className="h-auto w-44"
          />
          <p className="mt-3 max-w-xs text-sm text-ink/70">
            Gentle where it touches you, powerful where it needs to be.
          </p>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <p className="smallcaps text-brass-deep">{col.title}</p>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="link-underline text-sm text-ink/70 transition-colors hover:text-forest"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-8 py-6 sm:flex-row sm:justify-between">
          <p className="smallcaps text-ink/70">
            Bliss in Every Drop · Bharat Bliss Pvt Ltd · © {copyrightYear} 🍁
          </p>
          <div className="flex gap-5">
            <Link href="/privacy" className="smallcaps link-underline text-ink/70 hover:text-forest">
              Privacy
            </Link>
            <Link href="/terms" className="smallcaps link-underline text-ink/70 hover:text-forest">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}