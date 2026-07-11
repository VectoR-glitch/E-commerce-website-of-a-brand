"use client";
import { useActionState } from "react";
import { updateBlogPost, type BlogPostState } from "@/app/admin/actions";

const fieldCls = "border border-line bg-white px-2.5 py-1.5 text-sm outline-none focus:border-forest";

type Post = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  metaDescription: string | null;
  published: boolean;
  updatedAt: Date;
};

export function EditBlogPostForm({ post }: { post: Post }) {
  const [state, action, pending] = useActionState<BlogPostState, FormData>(updateBlogPost, undefined);

  return (
    <form key={post.updatedAt.toISOString()} action={action} className="mt-3 space-y-4">
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

      {state?.error && (
        <p className="border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
          {state.error}
        </p>
      )}

      <button disabled={pending} className="smallcaps bg-forest px-5 py-2 text-bone btn-fill-forest disabled:opacity-60">
        {pending ? "Saving…" : "Save post"}
      </button>
    </form>
  );
}
