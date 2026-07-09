import type { Metadata } from "next";

// contact/page.tsx is a client component ("use client", for the form state),
// and Next.js only allows a `metadata` export from a server component — so it
// lives here instead, in a layout that just passes children through.
const title = "Contact";
const description = "Get in touch with the Klenich team — questions, orders, or feedback.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/contact" },
  openGraph: { title, description },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
