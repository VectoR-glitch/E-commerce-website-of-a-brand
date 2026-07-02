import { formatINR } from "@/lib/catalog";
import { KitPicker } from "@/components/kit-picker";
import type { BundleView } from "@/lib/bundles";

export function BundleCard({ bundle }: { bundle: BundleView }) {
  const saveLabel =
    bundle.discountType === "PERCENT"
      ? `${bundle.discountValue}% off`
      : `Save ${formatINR(bundle.discountValue)}`;

  return (
    <div className="flex flex-col bg-paper md:flex-row">
      <div className="flex flex-1 flex-col p-7">
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
            imageUrl={bundle.imageUrl}
          />
        </div>
      </div>

      {bundle.imageUrl && (
        <div className="h-56 border-t border-line bg-bone md:h-auto md:w-2/5 md:border-l md:border-t-0">
          {/* Plain <img>: the ?v cache-buster is a dynamic query string, which
              next/image blocks unless whitelisted in images.localPatterns. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bundle.imageUrl}
            alt={bundle.name}
            className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
          />
        </div>
      )}
    </div>
  );
}
