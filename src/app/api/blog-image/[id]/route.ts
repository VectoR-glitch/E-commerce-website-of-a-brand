import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// Serves a blog post's cover photo stored in Postgres. Callers append
// ?v=<updatedAt> so the URL changes whenever the image is replaced, which lets
// us cache immutably.
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const post = await prisma.blogPost.findUnique({
    where: { id },
    select: { coverImageData: true, coverImageType: true, published: true },
  });
  if (!post?.coverImageData || !post.coverImageType) {
    return new Response("Not found", { status: 404 });
  }

  // Drafts are only visible to admins (the editor previews the image before
  // publishing) — the public blog pages never link an unpublished post's id,
  // but the route itself must not serve it to an anonymous guesser.
  if (!post.published) {
    const session = await getSession();
    if (session?.role !== "ADMIN") {
      return new Response("Not found", { status: 404 });
    }
  }

  return new Response(Buffer.from(post.coverImageData), {
    headers: {
      "Content-Type": post.coverImageType,
      "Cache-Control": post.published
        ? "public, max-age=31536000, immutable"
        : "private, no-store",
    },
  });
}
