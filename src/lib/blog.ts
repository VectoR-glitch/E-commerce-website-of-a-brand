import "server-only";
import { prisma } from "@/lib/prisma";

export type BlogListItem = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: Date;
  hasCoverImage: boolean;
  coverImageVersion: number; // updatedAt.getTime(), for the immutable-cache image URL
};

export type BlogPostDetail = BlogListItem & {
  body: string;
  metaDescription: string | null;
  updatedAt: Date;
};

// Published posts, newest first. Omits body/coverImageData — the list view
// never needs the full post or the image blob.
export async function getPublishedPosts(opts?: { take?: number; excludeSlug?: string }): Promise<BlogListItem[]> {
  const rows = await prisma.blogPost.findMany({
    where: { published: true, slug: opts?.excludeSlug ? { not: opts.excludeSlug } : undefined },
    orderBy: { publishedAt: "desc" },
    take: opts?.take,
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      publishedAt: true,
      coverImageType: true,
      updatedAt: true,
    },
  });

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt,
    // Non-null by the `published: true` filter (publishedAt is always set on publish).
    publishedAt: r.publishedAt!,
    hasCoverImage: !!r.coverImageType,
    coverImageVersion: r.updatedAt.getTime(),
  }));
}

export async function getPublishedPost(slug: string): Promise<BlogPostDetail | null> {
  const r = await prisma.blogPost.findFirst({
    where: { slug, published: true },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      body: true,
      metaDescription: true,
      publishedAt: true,
      updatedAt: true,
      coverImageType: true,
    },
  });
  if (!r) return null;

  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt,
    body: r.body,
    metaDescription: r.metaDescription,
    publishedAt: r.publishedAt!,
    updatedAt: r.updatedAt,
    hasCoverImage: !!r.coverImageType,
    coverImageVersion: r.updatedAt.getTime(),
  };
}

// Splits stored body text on blank lines into paragraphs for rendering.
export function bodyParagraphs(body: string): string[] {
  return body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}
