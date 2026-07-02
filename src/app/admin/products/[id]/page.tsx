import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import {
  updateProduct,
  updateVariant,
  createVariant,
  uploadProductImage,
  deleteProductImage,
  setPrimaryImage,
  deleteVariant,
  deleteProduct,
} from "@/app/admin/actions";
import { SkuEditor } from "@/components/sku-editor";
import { ConfirmSubmit } from "@/components/confirm-submit";

export const dynamic = "force-dynamic";

const rupees = (paise: number) => (paise / 100).toFixed(2);
const fieldCls = "border border-line bg-white px-2.5 py-1.5 text-sm outline-none focus:border-forest";

export default async function ProductEdit(props: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await props.params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      variants: { orderBy: [{ fragrance: "asc" }, { size: "asc" }] },
      images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
    },
  });
  if (!product) notFound();

  return (
    <div>
      <Link href="/admin/products" className="smallcaps text-ink/60 hover:text-forest">← Products</Link>
      <h1 className="mt-3 font-serif text-3xl">{product.name}</h1>

      {/* Product fields + editorial content */}
      <div className="mt-6 max-w-2xl border border-line bg-paper p-5">
        <h2 className="smallcaps text-brass-deep">Product &amp; content</h2>
        {/* key on updatedAt remounts the form after each save so its fields
            re-sync to the saved values — React 19 resets uncontrolled fields to
            their defaultValue after a server action, which otherwise reverts
            them to the pre-save values. */}
        <form key={product.updatedAt.toISOString()} action={updateProduct} className="mt-3 space-y-4">
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

      {/* Images (Cloudflare R2) */}
      <h2 className="mt-10 smallcaps text-brass-deep">Images</h2>
      {product.images.length > 0 ? (
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {product.images.map((img) => (
            <div key={img.id} className="border border-line bg-paper p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/product-image/${img.id}`} alt={img.alt ?? ""} className="aspect-square w-full bg-bone object-contain" />
              <div className="mt-1 text-xs text-ink/60">
                {[img.fragrance, img.size].filter(Boolean).join(" · ") || "default"}
                {img.isPrimary && <span className="ml-1 text-brass-deep">★ primary</span>}
              </div>
              <div className="mt-1.5 flex gap-2">
                {!img.isPrimary && (
                  <form action={setPrimaryImage}>
                    <input type="hidden" name="imageId" value={img.id} />
                    <button className="text-xs text-forest hover:underline">Make primary</button>
                  </form>
                )}
                <form action={deleteProductImage}>
                  <input type="hidden" name="imageId" value={img.id} />
                  <button className="text-xs text-red-600 hover:underline">Delete</button>
                </form>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-ink/50">No images yet.</p>
      )}

      <div className="mt-4 max-w-2xl border border-line bg-paper p-5">
        <h3 className="smallcaps text-brass-deep">Upload image</h3>
        <form action={uploadProductImage} className="mt-3 flex flex-wrap items-end gap-3">
          <input type="hidden" name="productId" value={product.id} />
          <div>
            <label className="smallcaps mb-1 block text-brass-deep">File</label>
            <input name="file" type="file" accept="image/webp,image/jpeg,image/png,image/avif" required className="text-sm" />
          </div>
          <div>
            <label className="smallcaps mb-1 block text-brass-deep">Fragrance</label>
            <input name="fragrance" placeholder="(any)" className={`${fieldCls} w-28`} />
          </div>
          <div>
            <label className="smallcaps mb-1 block text-brass-deep">Size</label>
            <input name="size" placeholder="(any)" className={`${fieldCls} w-20`} />
          </div>
          <div>
            <label className="smallcaps mb-1 block text-brass-deep">Alt text</label>
            <input name="alt" className={`${fieldCls} w-40`} />
          </div>
          <button className="smallcaps bg-forest px-5 py-2 text-bone btn-fill-forest">Upload</button>
        </form>
        <p className="mt-2 text-xs text-ink/55">WebP/JPEG/PNG/AVIF, up to 5 MB. Leave fragrance/size blank for a product-wide image. First upload becomes the primary.</p>
      </div>

      {/* Variants */}
      <h2 className="mt-10 smallcaps text-brass-deep">Variants</h2>
      <div className="mt-3 space-y-3">
        {product.variants.map((v) => (
          <div key={v.id} className="border border-line bg-paper p-4">
            <form key={`${v.id}-${v.updatedAt.getTime()}`} action={updateVariant} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="variantId" value={v.id} />
              <div>
                <label className="smallcaps mb-1 block text-brass-deep">SKU</label>
                {/* Read-only here — SKU is edited via the gated control below. */}
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
              {/* Delete lives in its own form — forms can't nest. */}
            </form>
            <div className="mt-2 flex items-center justify-between gap-3">
              <SkuEditor variantId={v.id} currentSku={v.sku} />
              <form action={deleteVariant}>
                <input type="hidden" name="variantId" value={v.id} />
                <ConfirmSubmit
                  message={`Permanently delete variant ${[v.fragrance, v.size].filter(Boolean).join(" · ")} (SKU ${v.sku})? Order history is kept. To just hide it from the store, untick Active instead.`}
                  className="smallcaps text-xs text-red-600 hover:underline"
                >
                  Delete variant
                </ConfirmSubmit>
              </form>
            </div>
          </div>
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

      {/* Danger zone */}
      <div className="mt-10 max-w-2xl border border-red-200 bg-red-50/50 p-5">
        <h2 className="smallcaps text-red-700">Danger zone</h2>
        <p className="mt-2 text-sm text-ink/70">
          Permanently delete this product and all {product.variants.length}{" "}
          {product.variants.length === 1 ? "variant" : "variants"} + images. Past
          orders keep their records. To just take it off the store, untick{" "}
          <span className="font-medium">Active</span> above instead.
        </p>
        <form action={deleteProduct} className="mt-3">
          <input type="hidden" name="productId" value={product.id} />
          <ConfirmSubmit
            message={`Permanently delete "${product.name}" and all its variants + images? This cannot be undone. Past orders are kept. To just hide it, untick Active instead.`}
            className="smallcaps border border-red-600 px-5 py-2 text-red-700 transition-colors hover:bg-red-600 hover:text-white"
          >
            Delete product
          </ConfirmSubmit>
        </form>
      </div>
    </div>
  );
}