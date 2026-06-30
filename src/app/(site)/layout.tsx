import { SiteHeader } from "@/components/site-header";
import { HeaderAdminLink } from "@/components/header-admin-link";
import { SiteFooter } from "@/components/site-footer";
import { CleaningFact } from "@/components/cleaning-fact";
import { ScrollProgress } from "@/components/scroll-progress";
import { BackToTop } from "@/components/back-to-top";
import { CartDrawer } from "@/components/cart-drawer";
import { MapleEasterEgg } from "@/components/maple-easter-egg";
import { CartProvider } from "@/lib/cart-context";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CartProvider>
      <a
        href="#main"
        className="smallcaps sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:bg-forest focus:px-4 focus:py-3 focus:text-bone"
      >
        Skip to content
      </a>
      <ScrollProgress />
      <SiteHeader adminSlot={<HeaderAdminLink />} />
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <CleaningFact />
      <SiteFooter />
      <BackToTop />
      <CartDrawer />
      <MapleEasterEgg />
    </CartProvider>
  );
}