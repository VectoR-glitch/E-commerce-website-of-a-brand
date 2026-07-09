import type { Metadata } from "next";
import Link from "next/link";
import { Ornament } from "@/components/ornament";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reset Password",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage(props: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await props.searchParams;

  // Validate the token before showing the form, so an expired/used/absent link
  // gives a clear message instead of a form that will only fail on submit.
  let valid = false;
  if (token) {
    const row = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(token) },
      select: { expiresAt: true, usedAt: true },
    });
    valid = Boolean(row && !row.usedAt && row.expiresAt >= new Date());
  }

  return (
    <div className="mx-auto max-w-md px-8 py-20">
      <header className="text-center">
        <span className="smallcaps text-brass-deep">Account</span>
        <h1 className="mt-4 font-serif text-5xl">Reset password</h1>
        <Ornament className="mt-6" />
      </header>

      {valid && token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="mt-10 border border-amber-300 bg-amber-50 px-4 py-5 text-sm text-amber-800">
          <p>This reset link is invalid, expired, or already used.</p>
          <Link href="/forgot-password" className="mt-2 inline-block font-medium text-forest underline">
            Request a new reset link
          </Link>
        </div>
      )}
    </div>
  );
}