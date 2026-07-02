import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { formatINR } from "@/lib/catalog";
import { bundleCouponCode } from "@/lib/bundles";
import { updateBundle, deleteBundle, addBundleItem, removeBundleItem } from "@/app/admin/actions";
import { ConfirmSubmit } from "@/components/confirm-submit";

export const dynamic = "force-dynamic";

const fieldCls = "border border-line bg-white px-2.5 py-1.5 text-sm outline-none focus:border-forest";

export default async function BundleEdit(props: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await props.params;

  const bundle = await prisma.bundle.findUnique({
    where: { id },
    include: { items: { include: { variant: { include: { product: true } } } } },
  });
  if (!bundle) notFound();

  // All active variants, for the add-item dropdown.
  const variants = await prisma.variant.findMany({
    where: { active: true },
    orderBy: [{ product: { name: "asc" } }, { size: "asc" }],
    include: { product: { select: { name: true } } },
  });

  const label = (v: (typeof variants)[number]) =>
    `${v.product.name} · ${[v.fragrance, v.size].filter(Boolean).join(" · ")} — ${formatINR(v.pricePaise)}`;

  const regularPaise = bundle.items.reduce(
    (s, it) => s + it.variant.pricePaise * it.quantity,
    0,
  );

  return (
    <div>
      <Link href="/admin/bundles" className="smallcaps text-ink/60 hover:text-forest">← Kits</Link>
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
            Slug <span className="font-mono">{bundle.slug}</span> is fixed. Regular total of current items: {formatINR(regularPaise)}.
          </p>
          <button className="smallcaps bg-forest px-5 py-2 text-bone btn-fill-forest">Save kit</button>
        </form>
      </div>

      {/* Items */}
      <h2 className="mt-10 smallcaps text-brass-deep">Items</h2>
      <div className="mt-3 space-y-2">
        {bundle.items.map((it) => (
          <div key={it.id} className="flex items-center justify-between border border-line bg-paper px-4 py-2.5 text-sm">
            <span>
              {it.quantity}× {it.variant.product.name}
              <span className="text-ink/50"> — {[it.variant.fragrance, it.variant.size].filter(Boolean).join(" · ")}</span>
              <span className="ml-2 text-ink/50">{formatINR(it.variant.pricePaise * it.quantity)}</span>
            </span>
            <form action={removeBundleItem}>
              <input type="hidden" name="bundleItemId" value={it.id} />
              <input type="hidden" name="bundleId" value={bundle.id} />
              <button className="text-xs text-red-600 hover:underline">Remove</button>
            </form>
          </div>
        ))}
        {bundle.items.length === 0 && <p className="text-sm text-ink/50">No items yet — add at least one.</p>}
      </div>

      <div className="mt-4 max-w-2xl border border-line bg-paper p-5">
        <h3 className="smallcaps text-brass-deep">Add item</h3>
        <form action={addBundleItem} className="mt-3 flex flex-wrap items-end gap-3">
          <input type="hidden" name="bundleId" value={bundle.id} />
          <div>
            <label className="smallcaps mb-1 block text-brass-deep">Variant</label>
            <select name="variantId" required className={`${fieldCls} min-w-[280px]`}>
              <option value="">Select a variant…</option>
              {variants.map((v) => (
                <option key={v.id} value={v.id}>{label(v)}</option>
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
