"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadProductImage } from "@/app/admin/actions";

const fieldCls = "border border-line bg-white px-2.5 py-1.5 text-sm outline-none focus:border-forest";
// Vercel's Serverless Functions hard-cap request bodies at 4.5MB regardless of
// Next's own serverActions.bodySizeLimit config — a raw upload over that limit
// doesn't reach our own code at all, it gets a platform-level 413 that the
// Server Action client runtime can't parse as a normal response, which crashes
// to the framework's default error page instead of showing a clean message.
// So the client-side compression below isn't just an optimization — never
// let an oversized file reach the network in the first place.
const MAX_DIMENSION = 2000;
const SAFE_UPLOAD_BYTES = 4 * 1024 * 1024; // headroom under Vercel's 4.5MB hard ceiling

type FileStatus = { name: string; state: "pending" | "done" | "error"; error?: string };

// Iteratively shrinks dimension + quality until the encode fits under
// SAFE_UPLOAD_BYTES, or gives up after a few attempts — large AI-generated
// images in particular can be far bigger (dimension and bytes) than typical
// camera photos, so a single fixed-quality pass isn't always enough.
async function compressImage(file: File): Promise<{ file: File; oversized: boolean }> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // Can't decode client-side (e.g. HEIC) — nothing we can do to shrink it.
    return { file, oversized: file.size > SAFE_UPLOAD_BYTES };
  }

  let dimension = MAX_DIMENSION;
  let quality = 0.85;
  let best = file;

  for (let attempt = 0; attempt < 6; attempt++) {
    const scale = Math.min(1, dimension / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) break;
    ctx.drawImage(bitmap, 0, 0, w, h);

    let blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    // Some older browsers silently no-op unsupported toBlob types — fall back to JPEG.
    if (!blob) blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size < best.size) {
      const ext = blob.type === "image/webp" ? "webp" : "jpg";
      best = new File([blob], file.name.replace(/\.[^.]+$/, "") + `.${ext}`, { type: blob.type });
      if (blob.size <= SAFE_UPLOAD_BYTES) break;
    }
    dimension = Math.round(dimension * 0.7);
    quality = Math.max(0.4, quality - 0.15);
  }
  bitmap.close();
  return { file: best, oversized: best.size > SAFE_UPLOAD_BYTES };
}

export function ProductImageUpload({ productId }: { productId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fragrance, setFragrance] = useState("");
  const [size, setSize] = useState("");
  const [alt, setAlt] = useState("");
  const [statuses, setStatuses] = useState<FileStatus[]>([]);
  const [uploading, setUploading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const files = inputRef.current?.files;
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    setUploading(true);
    setStatuses(list.map((f) => ({ name: f.name, state: "pending" })));

    // Sequential, not Promise.all — uploadProductImage's "first image becomes
    // primary" logic reads a count-so-far from the DB, which would race if
    // two uploads for the same product ran concurrently (both could see
    // count === 0 and both get flagged primary). Sequential keeps that
    // correct while still only needing one click for the whole batch.
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      try {
        const { file: processed, oversized } = await compressImage(file);
        if (oversized) {
          setStatuses((prev) =>
            prev.map((s, j) =>
              j === i
                ? { name: file.name, state: "error", error: "Too large even after compression — try a smaller image." }
                : s,
            ),
          );
          continue;
        }
        const formData = new FormData();
        formData.set("productId", productId);
        formData.set("file", processed);
        formData.set("fragrance", fragrance);
        formData.set("size", size);
        // A shared alt-text field only makes sense for a single file — leave
        // it blank across a multi-file batch rather than mislabel every image.
        formData.set("alt", list.length === 1 ? alt : "");
        const result = await uploadProductImage(undefined, formData);
        setStatuses((prev) =>
          prev.map((s, j) =>
            j === i ? { name: file.name, state: result.error ? "error" : "done", error: result.error } : s,
          ),
        );
      } catch {
        setStatuses((prev) =>
          prev.map((s, j) => (j === i ? { name: file.name, state: "error", error: "Upload failed." } : s)),
        );
      }
    }

    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  return (
    <div className="mt-4 max-w-2xl border border-line bg-paper p-5">
      <h3 className="smallcaps text-brass-deep">Upload images</h3>
      <form onSubmit={onSubmit} className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="smallcaps mb-1 block text-brass-deep">Files</label>
          <input
            ref={inputRef}
            name="file"
            type="file"
            accept="image/webp,image/jpeg,image/png,image/avif"
            multiple
            required
            className="text-sm"
          />
        </div>
        <div>
          <label className="smallcaps mb-1 block text-brass-deep">Fragrance</label>
          <input
            value={fragrance}
            onChange={(e) => setFragrance(e.target.value)}
            placeholder="(any)"
            className={`${fieldCls} w-28`}
          />
        </div>
        <div>
          <label className="smallcaps mb-1 block text-brass-deep">Size</label>
          <input
            value={size}
            onChange={(e) => setSize(e.target.value)}
            placeholder="(any)"
            className={`${fieldCls} w-20`}
          />
        </div>
        <div>
          <label className="smallcaps mb-1 block text-brass-deep">Alt text</label>
          <input value={alt} onChange={(e) => setAlt(e.target.value)} className={`${fieldCls} w-40`} />
        </div>
        <button
          disabled={uploading}
          className="smallcaps bg-forest px-5 py-2 text-bone btn-fill-forest disabled:opacity-60"
        >
          {uploading ? "Uploading…" : "Upload"}
        </button>
      </form>
      {statuses.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs">
          {statuses.map((s, i) => (
            <li
              key={i}
              className={
                s.state === "error" ? "text-red-700" : s.state === "done" ? "text-forest" : "text-ink/50"
              }
            >
              {s.name} — {s.state === "pending" ? "uploading…" : s.state === "done" ? "done ✓" : `error: ${s.error}`}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-ink/55">
        WebP/JPEG/PNG/AVIF. Select multiple files to upload them all in one go — each is automatically
        resized and compressed in your browser first. Leave fragrance/size blank for a product-wide
        image. First upload becomes the primary.
      </p>
    </div>
  );
}
