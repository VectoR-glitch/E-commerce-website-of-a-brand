import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { logoutAction } from "@/app/actions/auth";

// Every admin page is dynamic (live DB per request) and individually re-guards
// via requireAdmin(); this layout gate is the first line + supplies the nav.
export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/stock", label: "Stock" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/questions", label: "Q&A" },
  { href: "/admin/blog", label: "Journal" },
  { href: "/admin/coupons", label: "Coupons" },
  { href: "/admin/bundles", label: "Kits" },
  { href: "/admin/subscriptions", label: "Subscriptions" },
  { href: "/admin/loyalty", label: "Loyalty" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();

  return (
    <div className="min-h-screen bg-bone text-ink">
      <header className="border-b border-line bg-paper">
        <div className="mx-auto max-w-6xl px-6">
          {/* Row 1 — brand + account actions */}
          <div className="flex items-center justify-between gap-6 py-4">
            <Link href="/admin" className="font-serif text-lg tracking-wide text-forest">
              KLENICH <span className="text-brass-deep">Ops</span>
            </Link>
            <div className="flex items-center gap-4 text-sm">
              <span className="hidden text-ink/60 sm:inline">{session.email}</span>
              <Link href="/" className="text-ink/60 transition-colors hover:text-forest">View site</Link>
              <form action={logoutAction}>
                <button className="smallcaps border border-line px-3 py-1.5 text-ink/70 hover:border-forest transition-colors hover:text-forest">
                  Log out
                </button>
              </form>
            </div>
          </div>
          {/* Row 2 — section nav, wraps instead of scrolling */}
          <nav className="flex flex-wrap gap-x-6 gap-y-2 border-t border-line py-3 text-sm">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="text-ink/70 transition-colors hover:text-forest">
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}