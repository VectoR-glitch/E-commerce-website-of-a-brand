import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { updateBlogPost, deleteBlogPost, removeBlogImage } from "@/app/admin/actions";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { BlogImageUpload } from "@/components/blog-image-upload";

export const dynamic = "force-dynamic";

const fieldCls = "border border-line bg-white px-2.5 py-1.5 text-sm outline-none focus:border-forest";

export default async function BlogPostEdit(props: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await props.params;

  const post = await prisma.blogPost.findUnique({ where: { id }, omit: { coverImageData: true } });
  if (!post) notFound();

  return (
    <div>
      <Link href="/admin/blog" className="smallcaps text-ink/60 transition-colors hover:text-forest">← Journal</Link>
      <h1 className="mt-3 font-serif text-3xl">{post.title || "(untitled)"}</h1>
      {post.published ? (
        <p className="mt-1 text-sm text-ink/55">
          Live at <span className="font-mono">/blog/{post.slug}</span>
        </p>
      ) : (
        <p className="mt-1 text-sm text-ink/55">Draft — not visible on the site yet.</p>
      )}

      {/* Details */}
      <div className="mt-6 max-w-2xl border border-line bg-paper p-5">
        <h2 className="smallcaps text-brass-deep">Post</h2>
        <form key={post.updatedAt.toISOString()} action={updateBlogPost} className="mt-3 space-y-4">
          <input type="hidden" name="blogPostId" value={post.id} />
          <div>
            <label className="smallcaps mb-1 block text-brass-deep">Title</label>
            <input name="title" defaultValue={post.title} required maxLength={160} className={`${fieldCls} w-full`} />
          </div>
          <div>
            <label className="smallcaps mb-1 block text-brass-deep">Slug</label>
            <input
              name="slug"
              defaultValue={post.slug}
              required
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              className={`${fieldCls} w-full font-mono text-xs`}
            />
          </div>
          <div>
            <label className="smallcaps mb-1 block text-brass-deep">Excerpt</label>
            <textarea
              name="excerpt"
              defaultValue={post.excerpt}
              required
              rows={2}
              maxLength={300}
              placeholder="A short summary — shown on the journal list and as the fallback meta description."
              className={`${fieldCls} w-full`}
            />
          </div>
          <div>
            <label className="smallcaps mb-1 block text-brass-deep">Body</label>
            <textarea
              name="body"
              defaultValue={post.body}
              required
              rows={14}
              placeholder="Long-form copy. Leave a blank line between paragraphs."
              className={`${fieldCls} w-full`}
            />
          </div>
          <div>
            <label className="smallcaps mb-1 block text-brass-deep">Meta description (optional)</label>
            <input
              name="metaDescription"
              defaultValue={post.metaDescription ?? ""}
              maxLength={160}
              placeholder="Overrides the excerpt in search results, if set."
              className={`${fieldCls} w-full`}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="published" defaultChecked={post.published} /> Published
          </label>
          <button className="smallcaps bg-forest px-5 py-2 text-bone btn-fill-forest">Save post</button>
        </form>
      </div>

      {/* Cover image */}
      <div className="mt-6 max-w-2xl border border-line bg-paper p-5">
        <h2 className="smallcaps text-brass-deep">Cover photo</h2>
        {post.coverImageType ? (
          <div className="mt-3 flex flex-wrap items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/blog-image/${post.id}?v=${post.updatedAt.getTime()}`}
              alt={post.title}
              className="h-28 w-44 border border-line bg-bone object-cover"
            />
            <form action={removeBlogImage}>
              <input type="hidden" name="blogPostId" value={post.id} />
              <button className="text-xs text-red-600 hover:underline">Remove photo</button>
            </form>
          </div>
        ) : (
          <p className="mt-2 text-sm text-ink/50">No photo yet.</p>
        )}
        <BlogImageUpload blogPostId={post.id} hasImage={!!post.coverImageType} />
        <p className="mt-2 text-xs text-ink/55">WebP/JPEG/PNG/AVIF, up to 5 MB. Shown on the journal card and post header.</p>
      </div>

      {/* Danger zone */}
      <div className="mt-10 max-w-2xl border border-red-200 bg-red-50/50 p-5">
        <h2 className="smallcaps text-red-700">Danger zone</h2>
        <p className="mt-2 text-sm text-ink/70">Delete this post permanently.</p>
        <form action={deleteBlogPost} className="mt-3">
          <input type="hidden" name="blogPostId" value={post.id} />
          <ConfirmSubmit
            message={`Delete post "${post.title}"? This can't be undone.`}
            className="smallcaps border border-red-600 px-5 py-2 text-red-700 transition-colors hover:bg-red-600 hover:text-white"
          >
            Delete post
          </ConfirmSubmit>
        </form>
      </div>
    </div>
  );
}
