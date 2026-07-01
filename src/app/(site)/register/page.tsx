import { redirect } from "next/navigation";
import { Ornament } from "@/components/ornament";
import { RegisterForm } from "@/components/register-form";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  // Already signed in → no reason to register.
  const session = await getSession();
  if (session) redirect(session.role === "ADMIN" ? "/admin" : "/account");

  return (
    <div className="mx-auto max-w-md px-8 py-20">
      <header className="text-center">
        <span className="smallcaps text-brass-deep">Account</span>
        <h1 className="mt-4 font-serif text-5xl">Create account</h1>
        <Ornament className="mt-6" />
        <p className="mt-5 text-sm text-ink/60">
          Track orders, save your details, and check out faster.
        </p>
      </header>
      <RegisterForm />
    </div>
  );
}