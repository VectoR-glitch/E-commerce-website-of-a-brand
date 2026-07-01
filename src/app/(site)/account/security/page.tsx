import Link from "next/link";
import { requireSession } from "@/lib/session";
import { ChangePasswordForm } from "@/components/account/change-password-form";

export const dynamic = "force-dynamic";

export default async function AccountSecurityPage() {
  await requireSession("/account/security");

  return (
    <div className="mx-auto max-w-md px-8 py-16">
      <Link href="/account" className="smallcaps text-ink/60 hover:text-forest">← Account</Link>
      <h1 className="mt-3 font-serif text-4xl">Password</h1>
      <p className="mt-2 text-sm text-ink/60">Change the password you use to sign in.</p>

      <div className="mt-8 border border-line bg-paper p-6">
        <ChangePasswordForm />
      </div>
    </div>
  );
}