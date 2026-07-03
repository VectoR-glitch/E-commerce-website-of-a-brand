import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { formatINR } from "@/lib/catalog";
import { updateStock } from "@/app/admin/actions";
import { pendingAlertCounts } from "@/lib/back-in-stock";

export const dynamic = "force-dynamic";

const LOW_STOCK_THRESHOLD = 50;

export default async function StockPage() {
  await requireAdmin();

  const [variants, waiting] = await Promise.all([
    prisma.variant.findMany({
      orderBy: [{ active: "desc" }, { stock: "asc" }],
      include: { product: { select: { name: true } } },
    }),
    // How many customers are waiting on a back-in-stock alert per variant —
    // setting stock above 0 emails them all.
    pendingAlertCounts(),
  ]);

  const fieldCls = "border border-line bg-white px-2 py-1.5 text-sm outline-none focus:border-forest";

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h1 className="font-serif text-3xl">Stock</h1>
        <span className="text-sm text-ink/60">Absolute set · low &lt; {LOW_STOCK_THRESHOLD}</span>
      </div>

      <div className="mt-6 overflow-x-auto border border-line">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="bg-paper text-left text-ink/60">
              <th className="px-3 py-2 font-medium">SKU</th>
              <th className="px-3 py-2 font-medium">Product</th>
              <th className="px-3 py-2 font-medium">Variant</th>
              <th className="px-3 py-2 text-right font-medium">Price</th>
              <th className="px-3 py-2 text-right font-medium">Stock</th>
              <th className="px-3 py-2 text-right font-medium">Waiting</th>
              <th className="px-3 py-2 font-medium">Update</th>
            </tr>
          </thead>
          <tbody>
            {variants.map((v) => {
              const low = v.active && v.stock < LOW_STOCK_THRESHOLD;
              return (
                <tr key={v.id} className={`border-t border-line ${v.active ? "" : "opacity-50"}`}>
                  <td className="px-3 py-2 font-mono text-xs text-ink/70">{v.sku || "—"}</td>
                  <td className="px-3 py-2 text-ink">
                    {v.product.name}
                    {!v.active && <span className="ml-2 text-xs text-ink/50">(inactive)</span>}
                  </td>
                  <td className="px-3 py-2 text-ink/70">{[v.fragrance, v.size].filter(Boolean).join(" · ")}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap text-ink/70">{formatINR(v.pricePaise)}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${low ? "text-red-600" : "text-ink"}`}>
                    {v.stock}{low && <span className="ml-1 text-xs">low</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {waiting.get(v.id) ? (
                      <span
                        className="smallcaps inline-block border border-brass/40 bg-brass/10 px-2 py-0.5 text-xs text-brass-deep"
                        title={`${waiting.get(v.id)} waiting for a back-in-stock alert`}
                      >
                        {waiting.get(v.id)}
                      </span>
                    ) : (
                      <span className="text-ink/30">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <form action={updateStock} className="flex gap-2">
                      <input type="hidden" name="variantId" value={v.id} />
                      {/* key on the saved stock remounts the input after a save
                          so it shows the new value (React 19 resets uncontrolled
                          fields to defaultValue after a server action). */}
                      <input
                        key={v.stock}
                        name="stock"
                        type="number"
                        min={0}
                        defaultValue={v.stock}
                        className={`${fieldCls} w-20`}
                        aria-label={`Set stock for ${v.sku}`}
                      />
                      <button className="smallcaps border border-line px-3 py-1.5 text-ink/70 hover:border-forest hover:text-forest">
                        Set
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}