import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { createBundle } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

const fieldCls = "border border-line bg-white px-3 py-2 text-sm outline-none focus:border-forest";

export default async function AdminBundlesPage() {
  await requireAdmin();

  const bundles = await prisma.bundle.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { items: true } } },
  });

  return (
    <div>
      <h1 className="font-serif text-3xl">Kits</h1>
      <p className="mt-1 text-sm text-ink/60">
        Curated bundles. The discount is applied automatically when a shopper adds the kit at checkout.
      </p>

      <div className="mt-6 overflow-x-auto border border-line">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="bg-paper text-left text-ink/60">
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Slug</th>
              <th className="px-3 py-2 text-center font-medium">Items</th>
              <th className="px-3 py-2 text-center font-medium">Active</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {bundles.map((b) => (
              <tr key={b.id} className="border-t border-line">
                <td className="px-3 py-2 text-ink">{b.name}</td>
                <td className="px-3 py-2 font-mono text-xs text-ink/60">{b.slug}</td>
                <td className="px-3 py-2 text-center text-ink/70">{b._count.items}</td>
                <td className="px-3 py-2 text-center">{b.active ? "✓" : "—"}</td>
                <td className="px-3 py-2 text-right">
                  <Link href={`/admin/bundles/${b.id}`} className="text-forest hover:underline">Edit</Link>
                </td>
              </tr>
            ))}
            {bundles.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-ink/50">No kits yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-8 max-w-lg border border-line bg-paper p-5">
        <h2 className="smallcaps text-brass-deep">New kit</h2>
        <form action={createBundle} className="mt-3 space-y-3">
          <input name="name" required placeholder="Name (e.g. Full Home Kit)" className={`${fieldCls} w-full`} />
          <input
            name="slug"
            required
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            placeholder="slug (e.g. full-home-kit)"
            className={`${fieldCls} w-full`}
          />
          <div className="flex gap-3">
            <select name="discountType" defaultValue="PERCENT" className={fieldCls}>
              <option value="PERCENT">Percent off (%)</option>
              <option value="FIXED">Fixed off (₹)</option>
            </select>
            <input name="discountValue" type="number" step="0.01" min={0} required placeholder="Discount" className={`${fieldCls} w-32`} />
          </div>
          <p className="text-xs text-ink/55">Add the kit’s products after creating it.</p>
          <button className="smallcaps bg-forest px-5 py-2 text-bone btn-fill-forest">Create kit</button>
        </form>
      </div>
    </div>
  );
}
