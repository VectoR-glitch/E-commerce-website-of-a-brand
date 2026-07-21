import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { SITE_URL } from "@/lib/constants";
import { jsonLdHtml } from "@/lib/json-ld";
import { TabLoadingIndicator } from "@/components/tab-loading-indicator";
import { Analytics } from "@/components/analytics";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  style: ["normal", "italic"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const description =
  "Plant-powered home care, proudly made in India. Gentle where it touches you, powerful where it needs to be.";

export const metadata: Metadata = {
  title: {
    default: "Klenich — Bliss in Every Drop",
    template: "%s · Klenich",
  },
  description,
  metadataBase: new URL(SITE_URL),
  // og:image / twitter:image are injected automatically from app/opengraph-image.
  openGraph: {
    type: "website",
    siteName: "Klenich",
    title: "Klenich — Bliss in Every Drop",
    description,
    url: SITE_URL,
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "Klenich — Bliss in Every Drop",
    description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Site-wide Organization schema — helps Google associate the brand, logo,
  // and site. Complements the per-product Product schema on PDPs.
  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Klenich",
    url: SITE_URL,
    logo: `${SITE_URL}/brand/klenich-final.png`,
    description,
  };

  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} h-full`}
    >
      <body className="flex min-h-full flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdHtml(orgJsonLd) }}
        />
        <TabLoadingIndicator />
        <Analytics />
        {children}
      </body>
    </html>
  );
}