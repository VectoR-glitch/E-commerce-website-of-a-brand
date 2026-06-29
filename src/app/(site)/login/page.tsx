import { redirect } from "next/navigation";
import { Ornament } from "@/components/ornament";
import { LoginForm } from "@/components/login-form";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

function safeNext(next: string | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default async function LoginPage(props: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await props.searchParams;
  const target = safeNext(next);

  // Already signed in → don't show the form. Admins default to the console.
  const session = await getSession();
  if (session) {
    redirect(target === "/" && session.role === "ADMIN" ? "/admin" : target);
  }

  return (
    <div className="mx-auto max-w-md px-8 py-20">
      <header className="text-center">
        <span className="smallcaps text-brass-deep">Account</span>
        <h1 className="mt-4 font-serif text-5xl">Sign in</h1>
        <Ornament className="mt-6" />
      </header>
      <LoginForm next={target} />
    </div>
  );
}