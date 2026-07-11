"use client";
import { useActionState } from "react";
import { uploadProductImage, type ImageUploadState } from "@/app/admin/actions";

const fieldCls = "border border-line bg-white px-2.5 py-1.5 text-sm outline-none focus:border-forest";

export function ProductImageUpload({ productId }: { productId: string }) {
  const [state, action, pending] = useActionState<ImageUploadState, FormData>(uploadProductImage, {});

  return (
    <div className="mt-4 max-w-2xl border border-line bg-paper p-5">
      <h3 className="smallcaps text-brass-deep">Upload image</h3>
      <form action={action} className="mt-3 flex flex-wrap items-end gap-3">
        <input type="hidden" name="productId" value={productId} />
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
        <button disabled={pending} className="smallcaps bg-forest px-5 py-2 text-bone btn-fill-forest disabled:opacity-60">
          {pending ? "Uploading…" : "Upload"}
        </button>
      </form>
      {state.error && (
        <p className="mt-2 border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
          {state.error}
        </p>
      )}
      <p className="mt-2 text-xs text-ink/55">WebP/JPEG/PNG/AVIF, up to 5 MB. Leave fragrance/size blank for a product-wide image. First upload becomes the primary.</p>
    </div>
  );
}
