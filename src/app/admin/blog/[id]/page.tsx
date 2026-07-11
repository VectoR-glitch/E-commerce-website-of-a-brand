import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { deleteBlogPost, removeBlogImage } from "@/app/admin/actions";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { BlogImageUpload } from "@/components/blog-image-upload";
import { EditBlogPostForm } from "@/components/edit-blog-post-form";

export const dynamic = "force-dynamic";

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
        <EditBlogPostForm post={post} />
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
