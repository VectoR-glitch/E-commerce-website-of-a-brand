import type { Metadata } from "next";
import { Ornament } from "@/components/ornament";
import { Kicker } from "@/components/kicker";
import { BlogCard } from "@/components/blog-card";
import { getPublishedPosts } from "@/lib/blog";

export const dynamic = "force-dynamic";

const title = "The Journal";
const description =
  "Notes on plant-powered home care, ingredients, and cleaning the gentle way — from the Klenich team.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/blog" },
  openGraph: { title, description },
};

export default async function BlogIndexPage() {
  const posts = await getPublishedPosts();

  return (
    <div className="mx-auto max-w-6xl px-8 py-24">
      <header className="text-center">
        <Kicker>The Journal</Kicker>
        <h1 className="mt-4 font-serif text-5xl">Notes from Klenich</h1>
        <Ornament className="mt-6" />
        <p className="mx-auto mt-6 max-w-xl text-ink/70">
          Thoughts on ingredients, safe cleaning, and caring for a home the gentle way.
        </p>
      </header>

      {posts.length === 0 ? (
        <p className="mt-16 text-center text-sm text-ink/50">Nothing published yet — check back soon.</p>
      ) : (
        <div className="mt-16 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <BlogCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
