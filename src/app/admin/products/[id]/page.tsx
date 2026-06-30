import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { updateProduct, updateVariant, createVariant } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

const rupees = (paise: number) => (paise / 100).toFixed(2);
const fieldCls = "border border-line bg-white px-2.5 py-1.5 text-sm outline-none focus:border-forest";

export default async function ProductEdit(props: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await props.params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: { variants: { orderBy: [{ fragrance: "asc" }, { size: "asc" }] } },
  });
  if (!product) notFound();

  return (
    <div>
      <Link href="/admin/products" className="smallcaps text-ink/60 hover:text-forest">← Products</Link>
      <h1 className="mt-3 font-serif text-3xl">{product.name}</h1>

      {/* Product fields + editorial content */}
      <div className="mt-6 max-w-2xl border border-line bg-paper p-5">
        <h2 className="smallcaps text-brass-deep">Product &amp; content</h2>
        <form action={updateProduct} className="mt-3 space-y-4">
          <input type="hidden" name="productId" value={product.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="smallcaps mb-1 block text-brass-deep">Name</label>
              <input name="name" defaultValue={product.name} required className={`${fieldCls} w-full`} />
            </div>
            <div>
              <label className="smallcaps mb-1 block text-brass-deep">Claim tone</label>
              <select name="claimTone" defaultValue={product.claimTone ?? ""} className={`${fieldCls} w-full`}>
                <option value="">—</option>
                <option value="gentle">gentle</option>
                <option value="fresh">fresh</option>
                <option value="tough">tough</option>
              </select>
            </div>
            <div>
              <label className="smallcaps mb-1 block text-brass-deep">Tagline</label>
              <input name="tagline" defaultValue={product.tagline ?? ""} className={`${fieldCls} w-full`} />
            </div>
            <div>
              <label className="smallcaps mb-1 block text-brass-deep">Claim</label>
              <input name="claim" defaultValue={product.claim ?? ""} className={`${fieldCls} w-full`} />
            </div>
          </div>
          <div>
            <label className="smallcaps mb-1 block text-brass-deep">Description</label>
            <textarea name="description" defaultValue={product.description ?? ""} rows={4} className={`${fieldCls} w-full`} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="smallcaps mb-1 block text-brass-deep">Benefits <span className="text-ink/45">(one per line)</span></label>
              <textarea name="benefits" defaultValue={product.benefits.join("\n")} rows={4} className={`${fieldCls} w-full`} />
            </div>
            <div>
              <label className="smallcaps mb-1 block text-brass-deep">How to use <span className="text-ink/45">(one per line)</span></label>
              <textarea name="howToUse" defaultValue={product.howToUse.join("\n")} rows={4} className={`${fieldCls} w-full`} />
            </div>
          </div>
          <div>
            <label className="smallcaps mb-1 block text-brass-deep">Safety note <span className="text-ink/45">(optional)</span></label>
            <textarea name="safety" defaultValue={product.safety ?? ""} rows={2} className={`${fieldCls} w-full`} />
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <label className="smallcaps mb-1 block text-brass-deep">Emoji fallback</label>
              <input name="placeholder" defaultValue={product.placeholder ?? ""} className={`${fieldCls} w-24`} />
            </div>
            <label className="flex items-center gap-2 pt-5 text-sm">
              <input type="checkbox" name="active" defaultChecked={product.active} /> Active (visible on storefront)
            </label>
          </div>
          <p className="text-xs text-ink/55">Slug <span className="font-mono">{product.slug}</span> is fixed (changing it would break links).</p>
          <button className="smallcaps bg-forest px-5 py-2 text-bone btn-fill-forest">Save product</button>
        </form>
      </div>

      {/* Variants */}
      <h2 className="mt-10 smallcaps text-brass-deep">Variants</h2>
      <div className="mt-3 space-y-3">
        {product.variants.map((v) => (
          <form key={v.id} action={updateVariant} className="flex flex-wrap items-end gap-3 border border-line bg-paper p-4">
            <input type="hidden" name="variantId" value={v.id} />
            <div>
              <label className="smallcaps mb-1 block text-brass-deep">SKU</label>
              <input value={v.sku || "—"} disabled className={`${fieldCls} w-24 bg-bone/50 text-ink/50`} />
            </div>
            <div>
              <label className="smallcaps mb-1 block text-brass-deep">Fragrance</label>
              <input name="fragrance" defaultValue={v.fragrance ?? ""} placeholder="(none)" className={`${fieldCls} w-28`} />
            </div>
            <div>
              <label className="smallcaps mb-1 block text-brass-deep">Size</label>
              <input name="size" defaultValue={v.size} required className={`${fieldCls} w-20`} />
            </div>
            <div>
              <label className="smallcaps mb-1 block text-brass-deep">Price ₹</label>
              <input name="priceRupees" type="number" step="0.01" min={0} defaultValue={rupees(v.pricePaise)} required className={`${fieldCls} w-24`} />
            </div>
            <div>
              <label className="smallcaps mb-1 block text-brass-deep">Weight g</label>
              <input name="weightGrams" type="number" min={0} defaultValue={v.weightGrams ?? ""} placeholder="—" className={`${fieldCls} w-20`} />
            </div>
            <label className="flex items-center gap-1.5 pb-1.5 text-sm">
              <input type="checkbox" name="active" defaultChecked={v.active} /> Active
            </label>
            <button className="smallcaps border border-line px-4 py-1.5 text-ink/70 hover:border-forest hover:text-forest">Save</button>
          </form>
        ))}
        {product.variants.length === 0 && <p className="text-sm text-ink/50">No variants yet.</p>}
      </div>

      {/* Add variant */}
      <div className="mt-6 max-w-3xl border border-line bg-paper p-5">
        <h2 className="smallcaps text-brass-deep">Add variant</h2>
        <form action={createVariant} className="mt-3 flex flex-wrap items-end gap-3">
          <input type="hidden" name="productId" value={product.id} />
          <div>
            <label className="smallcaps mb-1 block text-brass-deep">SKU</label>
            <input name="sku" required className={`${fieldCls} w-28`} />
          </div>
          <div>
            <label className="smallcaps mb-1 block text-brass-deep">Fragrance</label>
            <input name="fragrance" placeholder="(none)" className={`${fieldCls} w-28`} />
          </div>
          <div>
            <label className="smallcaps mb-1 block text-brass-deep">Size</label>
            <input name="size" required className={`${fieldCls} w-20`} />
          </div>
          <div>
            <label className="smallcaps mb-1 block text-brass-deep">Price ₹</label>
            <input name="priceRupees" type="number" step="0.01" min={0} required className={`${fieldCls} w-24`} />
          </div>
          <div>
            <label className="smallcaps mb-1 block text-brass-deep">Stock</label>
            <input name="stock" type="number" min={0} defaultValue={0} className={`${fieldCls} w-20`} />
          </div>
          <button className="smallcaps bg-forest px-5 py-2 text-bone btn-fill-forest">Add</button>
        </form>
      </div>
    </div>
  );
}