import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { logoutAction } from "@/app/actions/auth";

// Every admin page is dynamic (live DB per request) and individually re-guards
// via requireAdmin(); this layout gate is the first line + supplies the nav.
export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/stock", label: "Stock" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/reviews", label: "Reviews" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();

  return (
    <div className="min-h-screen bg-bone text-ink">
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
          <div className="flex items-center gap-8">
            <Link href="/admin" className="font-serif text-lg tracking-wide text-forest">
              KLENICH <span className="text-brass-deep">Ops</span>
            </Link>
            <nav className="flex gap-5 text-sm">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="text-ink/70 hover:text-forest">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-ink/60 sm:inline">{session.email}</span>
            <Link href="/" className="text-ink/60 hover:text-forest">View site</Link>
            <form action={logoutAction}>
              <button className="smallcaps border border-line px-3 py-1.5 text-ink/70 hover:border-forest hover:text-forest">
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}