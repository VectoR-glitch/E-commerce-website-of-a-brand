import { SiteHeader } from "@/components/site-header";
import { HeaderAccount } from "@/components/header-account";
import { SiteFooter } from "@/components/site-footer";
import { CleaningFact } from "@/components/cleaning-fact";
import { ScrollProgress } from "@/components/scroll-progress";
import { BackToTop } from "@/components/back-to-top";
import { DropletCursor } from "@/components/droplet-cursor";
import { CartDrawer } from "@/components/cart-drawer";
import { MapleEasterEgg } from "@/components/maple-easter-egg";
import { NewsletterPopup } from "@/components/newsletter-popup";
import { CartProvider } from "@/lib/cart-context";
import { WishlistProvider } from "@/lib/wishlist-context";
import { RecentlyViewedProvider } from "@/lib/recently-viewed";
import { getSession } from "@/lib/session";
import { loadServerCartItems } from "@/lib/server-cart";
import { loadServerWishlistItems } from "@/lib/server-wishlist";
import { getFooterShopLinks } from "@/lib/products";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Seed the cart AND wishlist from the signed-in customer's server rows
  // (cross-device); guests start empty and hydrate from localStorage on the
  // client. Both are loaded together so a signed-in shopper's saved state is
  // present on first paint.
  const session = await getSession();
  const [initialItems, initialWishlist] = session
    ? await Promise.all([loadServerCartItems(session.sub), loadServerWishlistItems(session.sub)])
    : [[], []];
  const shopLinks = await getFooterShopLinks();

  return (
    <CartProvider authenticated={Boolean(session)} initialItems={initialItems}>
      <WishlistProvider authenticated={Boolean(session)} initialItems={initialWishlist}>
      <RecentlyViewedProvider>
      <a
        href="#main"
        className="smallcaps sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:bg-forest focus:px-4 focus:py-3 focus:text-bone"
      >
        Skip to content
      </a>
      <ScrollProgress />
      <DropletCursor />
      <SiteHeader accountSlot={<HeaderAccount />} />
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <CleaningFact />
      <SiteFooter shopLinks={shopLinks} />
      <BackToTop />
      <CartDrawer />
      <MapleEasterEgg />
      <NewsletterPopup />
      </RecentlyViewedProvider>
      </WishlistProvider>
    </CartProvider>
  );
}