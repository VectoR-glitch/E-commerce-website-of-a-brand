import { formatINR } from "@/lib/catalog";
import { KitPicker } from "@/components/kit-picker";
import type { BundleView } from "@/lib/bundles";

export function BundleCard({ bundle }: { bundle: BundleView }) {
  const saveLabel =
    bundle.discountType === "PERCENT"
      ? `${bundle.discountValue}% off`
      : `Save ${formatINR(bundle.discountValue)}`;

  return (
    <div className="flex flex-col bg-paper p-7">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-serif text-2xl">{bundle.name}</h3>
        <span className="smallcaps whitespace-nowrap bg-forest/10 px-2.5 py-1 text-xs text-forest">
          {saveLabel}
        </span>
      </div>
      {bundle.description && <p className="mt-2 text-sm text-ink/70">{bundle.description}</p>}

      <div className="mt-5 flex flex-1 flex-col border-t border-line pt-4">
        <KitPicker
          slots={bundle.slots}
          discountType={bundle.discountType}
          discountValue={bundle.discountValue}
          couponCode={bundle.couponCode}
        />
      </div>
    </div>
  );
}
