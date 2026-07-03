import { redirect } from "next/navigation";
import { Ornament } from "@/components/ornament";
import { RegisterForm } from "@/components/register-form";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function RegisterPage(props: PageProps<"/register">) {
  // Already signed in → no reason to register.
  const session = await getSession();
  if (session) redirect(session.role === "ADMIN" ? "/admin" : "/account");

  // A friend's referral link lands here as ?ref=CODE — carry it into the form
  // so registration can attribute the referral.
  const { ref } = await props.searchParams;
  const referral = typeof ref === "string" ? ref : undefined;

  return (
    <div className="mx-auto max-w-md px-8 py-20">
      <header className="text-center">
        <span className="smallcaps text-brass-deep">Account</span>
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
      <RegisterForm referral={referral} />
    </div>
  );
}