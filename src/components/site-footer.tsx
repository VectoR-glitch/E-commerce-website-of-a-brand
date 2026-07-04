import Link from "next/link";
import Image from "next/image";
import { Ornament } from "@/components/ornament";

const columns = [
  {
    title: "Shop",
    links: [
      { href: "/product/dishwash-gel-lime", label: "Dishwash Gel" },
      { href: "/product/floor-cleaner", label: "Floor Cleaner" },
      { href: "/product/toilet-cleaner", label: "Toilet Cleaner" },
    ],
  },
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

export function SiteFooter() {
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
            Bliss in Every Drop · Bharat Bliss Pvt Ltd · © {new Date().getFullYear()} 🍁
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