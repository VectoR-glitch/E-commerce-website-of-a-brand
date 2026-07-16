import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Ornament } from "@/components/ornament";
import { Kicker } from "@/components/kicker";
import { BlogCard } from "@/components/blog-card";
import { getPublishedPost, getPublishedPosts, findRedirectSlug, bodyParagraphs } from "@/lib/blog";
import { SITE_URL } from "@/lib/constants";
import { jsonLdHtml } from "@/lib/json-ld";

export const dynamic = "force-dynamic";

export async function generateMetadata(
  props: PageProps<"/blog/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const post = await getPublishedPost(slug);
  if (!post) return { title: "Not found" };

  const description = post.metaDescription ?? post.excerpt;
  const imageUrl = post.hasCoverImage
    ? `${SITE_URL}/api/blog-image/${post.id}?v=${post.coverImageVersion}`
    : undefined;

  return {
    title: post.title,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description,
      publishedTime: post.publishedAt.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

function articleJsonLd(post: NonNullable<Awaited<ReturnType<typeof getPublishedPost>>>) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.metaDescription ?? post.excerpt,
    datePublished: post.publishedAt.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    author: { "@type": "Organization", name: "Klenich" },
    publisher: { "@type": "Organization", name: "Klenich", logo: `${SITE_URL}/brand/klenich-final.png` },
    url: `${SITE_URL}/blog/${post.slug}`,
    ...(post.hasCoverImage && {
      image: `${SITE_URL}/api/blog-image/${post.id}?v=${post.coverImageVersion}`,
    }),
  };
}

// Lets Google show "The Journal › {post}" breadcrumbs directly in the search
// result instead of the raw URL. The current page is the last entry and
// intentionally has no `item` URL, matching Google's own reference example.
function breadcrumbJsonLd(post: { title: string; slug: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "The Journal", item: `${SITE_URL}/blog` },
      { "@type": "ListItem", position: 3, name: post.title },
    ],
  };
}

export default async function BlogPostPage(props: PageProps<"/blog/[slug]">) {
  const { slug } = await props.params;
  const post = await getPublishedPost(slug);
  if (!post) {
    const newSlug = await findRedirectSlug(slug);
    if (newSlug) redirect(`/blog/${newSlug}`);
    notFound();
  }

  const dateLabel = post.publishedAt.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
  const morePosts = await getPublishedPosts({ take: 2, excludeSlug: post.slug });
  const paragraphs = bodyParagraphs(post.body);

  return (
    <article className="mx-auto max-w-2xl px-8 py-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(articleJsonLd(post)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbJsonLd(post)) }}
      />
      <Link href="/blog" className="smallcaps text-ink/70 hover:text-forest">
        ← The Journal
      </Link>

      <header className="mt-8 text-center">
        <Kicker>{dateLabel}</Kicker>
        <h1 className="mt-3 font-serif text-4xl leading-tight">{post.title}</h1>
        <Ornament className="mt-6" />
      </header>

      {post.hasCoverImage && (
        <div className="mt-10 h-72 overflow-hidden border border-line bg-bone">
          {/* Plain <img>: the ?v cache-buster is a dynamic query string, which
              next/image blocks unless whitelisted in images.localPatterns. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/blog-image/${post.id}?v=${post.coverImageVersion}`}
            alt={post.title}
            className="h-full w-full object-cover"
          />
        </div>
      )}

      <div className="mt-10 space-y-6 text-lg leading-relaxed text-ink/75">
        {paragraphs.map((p, i) => (
          <p key={i} className={i === 0 ? "dropcap" : ""}>
            {p}
          </p>
        ))}
      </div>

      {morePosts.length > 0 && (
        <div className="mt-20 border-t border-line pt-12">
          <span className="smallcaps text-brass-deep">More from the journal</span>
          <div className="mt-6 grid gap-px border border-line bg-line sm:grid-cols-2">
            {morePosts.map((p) => (
              <BlogCard key={p.id} post={p} />
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
