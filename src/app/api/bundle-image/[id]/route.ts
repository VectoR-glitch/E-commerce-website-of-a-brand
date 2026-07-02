import { prisma } from "@/lib/prisma";

// Serves a kit's photo stored in Postgres. Callers append ?v=<updatedAt> so the
// URL changes whenever the image is replaced, which lets us cache immutably.
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const bundle = await prisma.bundle.findUnique({
    where: { id },
    select: { imageData: true, imageType: true },
  });
  if (!bundle?.imageData || !bundle.imageType) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(Buffer.from(bundle.imageData), {
    headers: {
      "Content-Type": bundle.imageType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
