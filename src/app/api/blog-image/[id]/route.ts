import { prisma } from "@/lib/prisma";

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
    select: { coverImageData: true, coverImageType: true },
  });
  if (!post?.coverImageData || !post.coverImageType) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(Buffer.from(post.coverImageData), {
    headers: {
      "Content-Type": post.coverImageType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
