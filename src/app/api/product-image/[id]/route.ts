import { prisma } from "@/lib/prisma";

// Serves a product image stored in Postgres. The id is immutable (a re-upload
// gets a new id), so the bytes for a given id never change — hence the
// long, immutable Cache-Control, which lets Vercel's edge cache them and keeps
// this handler off the hot path after the first hit.
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const img = await prisma.productImage.findUnique({
    where: { id },
    select: { data: true, contentType: true },
  });
  if (!img) return new Response("Not found", { status: 404 });

  return new Response(Buffer.from(img.data), {
    headers: {
      "Content-Type": img.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}