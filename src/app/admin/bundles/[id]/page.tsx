import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { formatINR } from "@/lib/catalog";
import { bundleCouponCode } from "@/lib/bundles";
import {
  updateBundle,
  deleteBundle,
  addBundleItem,
  removeBundleItem,
  removeBundleImage,
} from "@/app/admin/actions";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { KitImageUpload } from "@/components/kit-image-upload";

export const dynamic = "force-dynamic";

const fieldCls = "border border-line bg-white px-2.5 py-1.5 text-sm outline-none focus:border-forest";

export default async function BundleEdit(props: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await props.params;

  const bundle = await prisma.bundle.findUnique({
    where: { id },
    omit: { imageData: true }, // don't pull the blob into the page
    include: {
      items: {
        include: {
          variant: { include: { product: true } },
          product: true,
        },
      },
    },
  });
  if (!bundle) notFound();

  // All active variants, for the exact-slot dropdown.
  const variants = await prisma.variant.findMany({
    where: { active: true },
    orderBy: [{ product: { name: "asc" } }, { size: "asc" }],
    include: { product: { select: { name: true } } },
  });
  // Products + distinct sizes, for the flexible product-slot form.
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const sizes = [...new Set(variants.map((v) => v.size))].sort();

  const variantLabel = (v: (typeof variants)[number]) =>
    `${v.product.name} · ${[v.fragrance, v.size].filter(Boolean).join(" · ")} — ${formatINR(v.pricePaise)}`;

  // Human description of a slot (exact or flexible product slot).
  const slotLabel = (it: (typeof bundle.items)[number]): string => {
    if (it.variant) {
      return `${it.quantity}× ${it.variant.product.name} — ${[it.variant.fragrance, it.variant.size].filter(Boolean).join(" · ")}`;
    }
    if (it.product) {
      const size = it.size ? ` · ${it.size}` : " · any size";
      return `${it.quantity}× any ${it.product.name}${size} (customer picks)`;
    }
    return `${it.quantity}× (unavailable)`;
  };

  return (
    <div>
      <Link href="/admin/bundles" className="smallcaps text-ink/60 transition-colors hover:text-forest">← Kits</Link>
      <h1 className="mt-3 font-serif text-3xl">{bundle.name}</h1>
      <p className="mt-1 text-sm text-ink/55">
        Discount code <span className="font-mono">{bundleCouponCode(bundle.slug)}</span> is applied automatically at checkout.
      </p>

      {/* Details */}
      <div className="mt-6 max-w-2xl border border-line bg-paper p-5">
        <h2 className="smallcaps text-brass-deep">Kit details</h2>
        <form key={bundle.updatedAt.toISOString()} action={updateBundle} className="mt-3 space-y-4">
          <input type="hidden" name="bundleId" value={bundle.id} />
          <div>
            <label className="smallcaps mb-1 block text-brass-deep">Name</label>
            <input name="name" defaultValue={bundle.name} required className={`${fieldCls} w-full`} />
          </div>
          <div>
            <label className="smallcaps mb-1 block text-brass-deep">Description</label>
            <textarea name="description" defaultValue={bundle.description ?? ""} rows={2} className={`${fieldCls} w-full`} />
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="smallcaps mb-1 block text-brass-deep">Discount type</label>
              <select name="discountType" defaultValue={bundle.discountType} className={fieldCls}>
                <option value="PERCENT">Percent off (%)</option>
                <option value="FIXED">Fixed off (₹)</option>
              </select>
            </div>
            <div>
              <label className="smallcaps mb-1 block text-brass-deep">Value</label>
              <input
                name="discountValue"
                type="number"
                step="0.01"
                min={0}
                required
                defaultValue={bundle.discountType === "FIXED" ? bundle.discountValue / 100 : bundle.discountValue}
                className={`${fieldCls} w-28`}
              />
            </div>
            <label className="flex items-center gap-2 pb-1.5 text-sm">
              <input type="checkbox" name="active" defaultChecked={bundle.active} /> Active
            </label>
          </div>
          <p className="text-xs text-ink/55">
            Slug <span className="font-mono">{bundle.slug}</span> is fixed.
          </p>
          <button className="smallcaps bg-forest px-5 py-2 text-bone btn-fill-forest">Save kit</button>
        </form>
      </div>

      {/* Image */}
      <div className="mt-6 max-w-2xl border border-line bg-paper p-5">
        <h2 className="smallcaps text-brass-deep">Kit photo</h2>
        {bundle.imageType ? (
          <div className="mt-3 flex flex-wrap items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/bundle-image/${bundle.id}?v=${bundle.updatedAt.getTime()}`}
              alt={bundle.name}
              className="h-28 w-28 border border-line bg-bone object-contain"
            />
            <form action={removeBundleImage}>
              <input type="hidden" name="bundleId" value={bundle.id} />
              <button className="text-xs text-red-600 hover:underline">Remove photo</button>
            </form>
          </div>
        ) : (
          <p className="mt-2 text-sm text-ink/50">No photo yet.</p>
        )}
        <KitImageUpload bundleId={bundle.id} hasImage={!!bundle.imageType} />
        <p className="mt-2 text-xs text-ink/55">WebP/JPEG/PNG/AVIF, up to 5 MB. Shown on the kit card in the shop.</p>
      </div>

      {/* Items */}
      <h2 className="mt-10 smallcaps text-brass-deep">Items</h2>
      <div className="mt-3 space-y-2">
        {bundle.items.map((it) => (
          <div key={it.id} className="flex items-center justify-between border border-line bg-paper px-4 py-2.5 text-sm">
            <span>{slotLabel(it)}</span>
            <form action={removeBundleItem}>
              <input type="hidden" name="bundleItemId" value={it.id} />
              <input type="hidden" name="bundleId" value={bundle.id} />
              <button className="text-xs text-red-600 hover:underline">Remove</button>
            </form>
          </div>
        ))}
        {bundle.items.length === 0 && <p className="text-sm text-ink/50">No items yet — add at least one.</p>}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Exact variant slot */}
        <div className="border border-line bg-paper p-5">
          <h3 className="smallcaps text-brass-deep">Add a specific variant</h3>
          <p className="mt-1 text-xs text-ink/55">A fixed item — e.g. Floor Cleaner, Lavender, 1L.</p>
          <form action={addBundleItem} className="mt-3 flex flex-wrap items-end gap-3">
            <input type="hidden" name="bundleId" value={bundle.id} />
            <div>
              <label className="smallcaps mb-1 block text-brass-deep">Variant</label>
              <select name="variantId" required className={`${fieldCls} min-w-[240px]`}>
                <option value="">Select a variant…</option>
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>{variantLabel(v)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="smallcaps mb-1 block text-brass-deep">Qty</label>
              <input name="quantity" type="number" min={1} defaultValue={1} className={`${fieldCls} w-16`} />
            </div>
            <button className="smallcaps bg-forest px-5 py-1.5 text-bone btn-fill-forest">Add</button>
          </form>
        </div>

        {/* Flexible product slot */}
        <div className="border border-line bg-paper p-5">
          <h3 className="smallcaps text-brass-deep">Add a “customer’s choice” slot</h3>
          <p className="mt-1 text-xs text-ink/55">Any variant of a product — e.g. “any Floor Cleaner, 1L”. The shopper picks the fragrance.</p>
          <form action={addBundleItem} className="mt-3 flex flex-wrap items-end gap-3">
            <input type="hidden" name="bundleId" value={bundle.id} />
            <div>
              <label className="smallcaps mb-1 block text-brass-deep">Product</label>
              <select name="productId" required className={`${fieldCls} min-w-[180px]`}>
                <option value="">Select a product…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="smallcaps mb-1 block text-brass-deep">Size</label>
              <select name="size" className={fieldCls} defaultValue="">
                <option value="">Any size</option>
                {sizes.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="smallcaps mb-1 block text-brass-deep">Qty</label>
              <input name="quantity" type="number" min={1} defaultValue={1} className={`${fieldCls} w-16`} />
            </div>
            <button className="smallcaps bg-forest px-5 py-1.5 text-bone btn-fill-forest">Add</button>
          </form>
        </div>
      </div>

      {/* Danger zone */}
      <div className="mt-10 max-w-2xl border border-red-200 bg-red-50/50 p-5">
        <h2 className="smallcaps text-red-700">Danger zone</h2>
        <p className="mt-2 text-sm text-ink/70">Delete this kit and its discount code. Past orders are unaffected.</p>
        <form action={deleteBundle} className="mt-3">
          <input type="hidden" name="bundleId" value={bundle.id} />
          <ConfirmSubmit
            message={`Delete kit "${bundle.name}"? This removes its discount code too.`}
            className="smallcaps border border-red-600 px-5 py-2 text-red-700 transition-colors hover:bg-red-600 hover:text-white"
          >
            Delete kit
          </ConfirmSubmit>
        </form>
      </div>
    </div>
  );
}
