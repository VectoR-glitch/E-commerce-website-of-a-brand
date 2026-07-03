import { SiteHeader } from "@/components/site-header";
import { HeaderAccount } from "@/components/header-account";
import { SiteFooter } from "@/components/site-footer";
import { CleaningFact } from "@/components/cleaning-fact";
import { ScrollProgress } from "@/components/scroll-progress";
import { BackToTop } from "@/components/back-to-top";
import { CartDrawer } from "@/components/cart-drawer";
import { MapleEasterEgg } from "@/components/maple-easter-egg";
import { CartProvider } from "@/lib/cart-context";
import { WishlistProvider } from "@/lib/wishlist-context";
import { getSession } from "@/lib/session";
import { loadServerCartItems } from "@/lib/server-cart";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Seed the cart from the signed-in customer's server cart (cross-device);
  // guests start empty and hydrate from localStorage on the client.
  const session = await getSession();
  const initialItems = session ? await loadServerCartItems(session.sub) : [];

  return (
    <CartProvider authenticated={Boolean(session)} initialItems={initialItems}>
      <WishlistProvider>
      <a
        href="#main"
        className="smallcaps sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:bg-forest focus:px-4 focus:py-3 focus:text-bone"
      >
        Skip to content
      </a>
      <ScrollProgress />
      <SiteHeader accountSlot={<HeaderAccount />} />
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <CleaningFact />
      <SiteFooter />
      <BackToTop />
      <CartDrawer />
      <MapleEasterEgg />
      </WishlistProvider>
    </CartProvider>
  );
}