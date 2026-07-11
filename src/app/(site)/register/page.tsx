import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Ornament } from "@/components/ornament";
import { Kicker } from "@/components/kicker";
import { RegisterForm } from "@/components/register-form";
import { getSession } from "@/lib/session";
import { safeNext } from "@/lib/auth";

export const dynamic = "force-dynamic";

// No unique public content, and indexing it would just dilute the pages that
// actually matter for search.
export const metadata: Metadata = {
  title: "Create Account",
  robots: { index: false, follow: false },
};

export default async function RegisterPage(props: PageProps<"/register">) {
  // Already signed in → no reason to register.
  const session = await getSession();
  if (session) redirect(session.role === "ADMIN" ? "/admin" : "/account");

  // A friend's referral link lands here as ?ref=CODE — carry it into the form
  // so registration can attribute the referral.
  const { ref, next } = await props.searchParams;
  const referral = typeof ref === "string" ? ref : undefined;
  // Signing up mid-checkout (e.g. /register?next=/checkout) should return the
  // shopper there after they verify + log in, same as the /login?next= path.
  const target = safeNext(typeof next === "string" ? next : undefined);

  return (
    <div className="mx-auto max-w-md px-8 py-20">
      <header className="text-center">
        <Kicker>Account</Kicker>
        <h1 className="mt-4 font-serif text-5xl">Create account</h1>
        <Ornament className="mt-6" />
        <p className="mt-5 text-sm text-ink/60">
          Track orders, save your details, and check out faster.
        </p>
        {referral && (
          <p className="mt-4 border border-forest/30 bg-forest/5 px-4 py-2.5 text-sm text-forest">
            🎁 You were referred by a friend — you&rsquo;ll both earn bonus points
            on your first order.
          </p>
        )}
      </header>
      <RegisterForm referral={referral} next={target} />
    </div>
  );
}