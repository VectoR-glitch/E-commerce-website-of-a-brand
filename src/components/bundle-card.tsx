import { formatINR } from "@/lib/catalog";
import { AddBundleButton } from "@/components/add-bundle-button";
import type { BundleView } from "@/lib/bundles";

export function BundleCard({ bundle }: { bundle: BundleView }) {
  return (
    <div className="flex flex-col bg-paper p-7">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-serif text-2xl">{bundle.name}</h3>
        {bundle.discountPaise > 0 && (
          <span className="smallcaps whitespace-nowrap bg-forest/10 px-2.5 py-1 text-xs text-forest">
            Save {formatINR(bundle.discountPaise)}
          </span>
        )}
      </div>
      {bundle.description && <p className="mt-2 text-sm text-ink/70">{bundle.description}</p>}

      <ul className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
        {bundle.items.map((it) => (
          <li key={it.variantId} className="flex justify-between gap-3 text-ink/75">
            <span>
              {it.quantity}× {it.productName}
              {it.label && <span className="text-ink/50"> — {it.label}</span>}
            </span>
            <span className="whitespace-nowrap">{formatINR(it.pricePaise * it.quantity)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto">
        <div className="mt-5 flex items-baseline gap-2.5 border-t border-line pt-4">
          <span className="font-serif text-2xl">{formatINR(bundle.kitPaise)}</span>
          {bundle.discountPaise > 0 && (
            <span className="text-sm text-ink/45 line-through">{formatINR(bundle.regularPaise)}</span>
          )}
        </div>
        <div className="mt-4">
          <AddBundleButton items={bundle.items} couponCode={bundle.couponCode} />
        </div>
      </div>
    </div>
  );
}
