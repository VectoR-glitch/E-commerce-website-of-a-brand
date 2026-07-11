"use client";
import { useActionState } from "react";
import { createBlogPost, type BlogPostState } from "@/app/admin/actions";

const fieldCls = "border border-line bg-white px-3 py-2 text-sm outline-none focus:border-forest";

export function NewBlogPostForm() {
  const [state, action, pending] = useActionState<BlogPostState, FormData>(createBlogPost, undefined);

  return (
    <form action={action} className="mt-3 space-y-3">
      <input name="title" required placeholder="Title" className={`${fieldCls} w-full`} />
      <input
        name="slug"
        required
        pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
        placeholder="slug (e.g. why-plant-powered-cleaning-matters)"
        className={`${fieldCls} w-full`}
      />
      <p className="text-xs text-ink/55">Add the excerpt, body and cover photo after creating it.</p>
      {state?.error && (
        <p className="border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
          {state.error}
        </p>
      )}
      <button disabled={pending} className="smallcaps bg-forest px-5 py-2 text-bone btn-fill-forest disabled:opacity-60">
        {pending ? "Creating…" : "Create draft"}
      </button>
    </form>
  );
}
