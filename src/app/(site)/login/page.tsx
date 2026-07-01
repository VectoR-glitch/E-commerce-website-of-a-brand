import Link from "next/link";
import { redirect } from "next/navigation";
import { Ornament } from "@/components/ornament";
import { LoginForm } from "@/components/login-form";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

function safeNext(next: string | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

// Status banners shown above the form after a verification link / signup.
const NOTICES: Record<string, { tone: "ok" | "info" | "warn"; text: string }> = {
  verified: { tone: "ok", text: "Email verified — you can now sign in." },
  "verify-sent": {
    tone: "info",
    text: "Almost there — check your inbox for a verification link, then sign in.",
  },
  "verify-expired": {
    tone: "warn",
    text: "That verification link has expired. Sign in to have a new one sent.",
  },
  "verify-invalid": { tone: "warn", text: "That verification link isn't valid." },
  "reset-done": { tone: "ok", text: "Password updated — sign in with your new password." },
};

const TONE: Record<string, string> = {
  ok: "border-forest/30 bg-forest/5 text-forest",
  info: "border-brass/30 bg-brass/5 text-brass-deep",
  warn: "border-amber-300 bg-amber-50 text-amber-800",
};

export default async function LoginPage(props: {
  searchParams: Promise<{ next?: string; notice?: string }>;
}) {
  const { next, notice } = await props.searchParams;
  const target = safeNext(next);

  // Already signed in → don't show the form. Admins default to the console.
  const session = await getSession();
  if (session) {
    redirect(target === "/" && session.role === "ADMIN" ? "/admin" : target);
  }

  const banner = notice ? NOTICES[notice] : undefined;

  return (
    <div className="mx-auto max-w-md px-8 py-20">
      <header className="text-center">
        <span className="smallcaps text-brass-deep">Account</span>
        <h1 className="mt-4 font-serif text-5xl">Sign in</h1>
        <Ornament className="mt-6" />
      </header>

      {banner && (
        <p className={`mt-8 border px-3.5 py-2.5 text-sm ${TONE[banner.tone]}`}>{banner.text}</p>
      )}

      <LoginForm next={target} />

      <p className="mt-6 text-center text-sm text-ink/60">
        New to Klenich?{" "}
        <Link href="/register" className="text-forest hover:underline">Create an account</Link>
      </p>
    </div>
  );
}