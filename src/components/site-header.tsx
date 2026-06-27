import Link from "next/link";
import Image from "next/image";
import { CartCount } from "@/components/cart-count";
import { MobileNav } from "@/components/mobile-nav";

const navLinks = [
  { href: "/shop", label: "Shop" },
  { href: "/why-klenich", label: "Why Klenich" },
  { href: "/our-story", label: "Our Story" },
  { href: "/help", label: "Help" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bone/90 backdrop-blur">
      <div className="bg-ink text-bone">
        <p className="smallcaps mx-auto max-w-6xl px-8 py-2.5 text-center">
          Plant-powered home care · Made in India · Dispatched within 1 working day
        </p>
      </div>
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-8">
        <Link href="/" className="flex items-center">
          <Image
            src="/brand/klenich-final.png"
            alt="Klenich"
            width={901}
            height={374}
            className="h-11 w-auto"
            priority
          />
        </Link>
        <nav className="hidden gap-10 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="smallcaps link-underline text-ink/70 transition-colors hover:text-forest"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <CartCount />
          <MobileNav />
        </div>
      </div>
    </header>
  );
}