import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { NewBlogPostForm } from "@/components/new-blog-post-form";

export const dynamic = "force-dynamic";

const dateFmt = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default async function AdminBlogPage() {
  await requireAdmin();

  const posts = await prisma.blogPost.findMany({
    orderBy: [{ published: "asc" }, { createdAt: "desc" }],
    select: { id: true, title: true, slug: true, published: true, publishedAt: true, updatedAt: true },
  });

  return (
    <div>
      <h1 className="font-serif text-3xl">Journal</h1>
      <p className="mt-1 text-sm text-ink/60">
        The site&rsquo;s blog. Drafts stay hidden until you publish them from the post editor.
      </p>

      <div className="mt-6 overflow-x-auto border border-line">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="bg-paper text-left text-ink/60">
              <th className="px-3 py-2 font-medium">Title</th>
              <th className="px-3 py-2 font-medium">Slug</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Last edited</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {posts.map((p) => (
              <tr key={p.id} className="border-t border-line">
                <td className="px-3 py-2 text-ink">{p.title || <span className="text-ink/40">(untitled)</span>}</td>
                <td className="px-3 py-2 font-mono text-xs text-ink/60">{p.slug}</td>
                <td className="px-3 py-2">
                  {p.published ? (
                    <span className="smallcaps text-xs text-forest">✓ Published</span>
                  ) : (
                    <span className="smallcaps text-xs text-[#9a6b1f]">Draft</span>
                  )}
                </td>
                <td className="px-3 py-2 text-ink/60">{dateFmt(p.updatedAt)}</td>
                <td className="px-3 py-2 text-right">
                  <Link href={`/admin/blog/${p.id}`} className="text-forest hover:underline">Edit</Link>
                </td>
              </tr>
            ))}
            {posts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-ink/50">No posts yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-8 max-w-lg border border-line bg-paper p-5">
        <h2 className="smallcaps text-brass-deep">New post</h2>
        <NewBlogPostForm />
      </div>
    </div>
  );
}
