"use client";
import { useState } from "react";
import { uploadBlogImage } from "@/app/admin/actions";

// Two-step upload: press "Choose photo" to pick a file (shows its name), then
// press "Upload" to submit. Upload stays disabled until a file is selected.
export function BlogImageUpload({ blogPostId, hasImage }: { blogPostId: string; hasImage: boolean }) {
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <form action={uploadBlogImage} className="mt-3 flex flex-wrap items-center gap-3">
      <input type="hidden" name="blogPostId" value={blogPostId} />
      <label className="smallcaps cursor-pointer border border-forest px-5 py-2 text-forest btn-fill">
        {hasImage ? "Choose new photo" : "Choose photo"}
        <input
          type="file"
          name="file"
          accept="image/webp,image/jpeg,image/png,image/avif"
          required
          className="hidden"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        />
      </label>
      {fileName && <span className="max-w-[220px] truncate text-xs text-ink/60">{fileName}</span>}
      <button
        type="submit"
        disabled={!fileName}
        className="smallcaps bg-forest px-6 py-2 text-bone btn-fill-forest transition-transform duration-150 hover:-translate-y-0.5 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
      >
        Upload
      </button>
    </form>
  );
}
