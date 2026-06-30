import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { createProduct } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  await requireAdmin();

  const products = await prisma.product.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { variants: true } } },
  });

  const fieldCls = "border border-line bg-white px-3 py-2 text-sm outline-none focus:border-forest";

  return (
    <div>
      <h1 className="font-serif text-3xl">Products</h1>

      <div className="mt-6 overflow-x-auto border border-line">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="bg-paper text-left text-ink/60">
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Slug</th>
              <th className="px-3 py-2 text-center font-medium">Variants</th>
              <th className="px-3 py-2 text-center font-medium">Active</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t border-line">
                <td className="px-3 py-2 text-ink">{p.name}</td>
                <td className="px-3 py-2 font-mono text-xs text-ink/60">{p.slug}</td>
                <td className="px-3 py-2 text-center text-ink/70">{p._count.variants}</td>
                <td className="px-3 py-2 text-center">{p.active ? "✓" : "—"}</td>
                <td className="px-3 py-2 text-right">
                  <Link href={`/admin/products/${p.id}`} className="text-forest hover:underline">Edit</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8 max-w-md border border-line bg-paper p-5">
        <h2 className="smallcaps text-brass-deep">New product</h2>
        <form action={createProduct} className="mt-3 space-y-3">
          <input name="name" placeholder="Name (e.g. Glass Cleaner)" required className={`${fieldCls} w-full`} />
          <input name="slug" placeholder="slug (e.g. glass-cleaner)" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" className={`${fieldCls} w-full`} />
          <p className="text-xs text-ink/55">Lowercase letters, numbers and hyphens. Must match the storefront route + Sanity slug.</p>
          <button className="smallcaps bg-forest px-5 py-2 text-bone btn-fill-forest">Create</button>
        </form>
      </div>
    </div>
  );
}