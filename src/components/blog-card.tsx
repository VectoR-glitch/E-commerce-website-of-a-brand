import Link from "next/link";
import type { BlogListItem } from "@/lib/blog";

export function BlogCard({ post }: { post: BlogListItem }) {
  const dateLabel = post.publishedAt.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Link href={`/blog/${post.slug}`} className="group flex flex-col bg-paper transition-colors hover:bg-white">
      <div className="relative h-52 overflow-hidden border-b border-line bg-bone">
        {post.hasCoverImage ? (
          // Plain <img>: the ?v cache-buster is a dynamic query string, which
          // next/image blocks unless whitelisted in images.localPatterns.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/blog-image/${post.id}?v=${post.coverImageVersion}`}
            alt={post.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-5xl">
            <span aria-hidden>🌿</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col px-6 py-6">
        <span className="smallcaps text-xs text-brass-deep">{dateLabel}</span>
        <h2 className="mt-2 font-serif text-xl leading-snug">{post.title}</h2>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-ink/70">{post.excerpt}</p>
        <span className="smallcaps link-underline mt-4 text-sm text-forest">Read more</span>
      </div>
    </Link>
  );
}
