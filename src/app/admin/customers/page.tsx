import Link from "next/link";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

const ROLES = Object.values(Role);
const PAGE_SIZE = 200;

type SP = { q?: string; role?: string };

// toISOString() is always UTC — Klenich operates in IST (UTC+5:30).
function fmtDate(d: Date): string {
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function CustomersPage(props: { searchParams: Promise<SP> }) {
  await requireAdmin();
  const sp = await props.searchParams;

  // "Account holders" = an actual login account (passwordHash set) — guest
  // checkout rows never get one, so they're excluded from this directory by
  // default (their orders are still visible on the Orders page).
  const where: Prisma.CustomerWhereInput = { passwordHash: { not: null } };
  if (sp.role && ROLES.includes(sp.role as Role)) {
    where.role = sp.role as Role;
  }
  const q = (sp.q ?? "").trim();
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
    ];
  }

  const customers = await prisma.customer.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      emailVerified: true,
      points: true,
      lifetimePoints: true,
      createdAt: true,
      _count: { select: { orders: true } },
      addresses: {
        where: { isDefault: true },
        take: 1,
        select: { line1: true, line2: true, city: true, state: true, pincode: true },
      },
    },
  });

  const labelCls = "smallcaps text-brass-deep block mb-1";
  const fieldCls = "border border-line bg-white px-3 py-2 text-sm outline-none focus:border-forest";

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h1 className="font-serif text-3xl">Customers</h1>
        <span className="text-sm text-ink/60">
          {customers.length}{customers.length === PAGE_SIZE ? "+" : ""} account holders
        </span>
      </div>
      <p className="mt-1 text-sm text-ink/55">
        Registered accounts only — guest checkouts never create a login and don&rsquo;t appear here.
      </p>

      {/* GET form → server-side filtering, no client JS */}
      <form method="get" className="mt-6 flex flex-wrap items-end gap-3 border border-line bg-paper p-4">
        <div>
          <label className={labelCls}>Role</label>
          <select name="role" defaultValue={sp.role ?? ""} className={fieldCls}>
            <option value="">All</option>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className={labelCls}>Search (name / email / phone)</label>
          <input name="q" defaultValue={q} placeholder="name, email, or phone" className={`${fieldCls} w-full`} />
        </div>
        <button type="submit" className="smallcaps bg-forest px-5 py-2 text-bone btn-fill-forest">Filter</button>
        <Link href="/admin/customers" className="smallcaps px-3 py-2 text-ink/60 transition-colors hover:text-forest">Reset</Link>
      </form>

      <div className="mt-6 overflow-x-auto border border-line">
        <table className="w-full min-w-[1000px] border-collapse text-sm">
          <thead>
            <tr className="bg-paper text-left text-ink/60">
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Phone</th>
              <th className="px-3 py-2 font-medium">Address</th>
              <th className="px-3 py-2 font-medium">Verified</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 text-right font-medium">Orders</th>
              <th className="px-3 py-2 text-right font-medium">Points</th>
              <th className="px-3 py-2 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-t border-line transition-colors hover:bg-paper/60">
                <td className="px-3 py-2 text-ink">{c.name ?? "—"}</td>
                <td className="px-3 py-2 text-ink/70">{c.email}</td>
                <td className="px-3 py-2 text-ink/70">{c.phone ?? "—"}</td>
                <td className="px-3 py-2 text-ink/70">
                  {c.addresses[0] ? (
                    <>
                      <div>{c.addresses[0].line1}{c.addresses[0].line2 ? `, ${c.addresses[0].line2}` : ""}</div>
                      <div className="text-xs text-ink/55">
                        {c.addresses[0].city}, {c.addresses[0].state} — {c.addresses[0].pincode}
                      </div>
                    </>
                  ) : (
                    <span className="text-ink/40">No saved address</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {c.emailVerified ? (
                    <span className="text-forest">✓</span>
                  ) : (
                    <span className="text-ink/40">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-ink/70">{c.role}</td>
                <td className="px-3 py-2 text-right">
                  {c._count.orders > 0 ? (
                    <Link
                      href={`/admin/orders?q=${encodeURIComponent(c.email)}`}
                      className="text-forest hover:underline"
                    >
                      {c._count.orders}
                    </Link>
                  ) : (
                    <span className="text-ink/40">0</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right text-ink/70">
                  {c.points.toLocaleString("en-IN")}
                  {c.lifetimePoints > c.points && (
                    <span className="text-ink/40"> / {c.lifetimePoints.toLocaleString("en-IN")}</span>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-ink/70">{fmtDate(c.createdAt)}</td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-10 text-center text-ink/50">No account holders match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
