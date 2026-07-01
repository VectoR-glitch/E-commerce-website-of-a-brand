import { Ornament } from "@/components/ornament";
import { ForgotPasswordForm } from "@/components/forgot-password-form";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-md px-8 py-20">
      <header className="text-center">
        <span className="smallcaps text-brass-deep">Account</span>
        <h1 className="mt-4 font-serif text-5xl">Forgot password</h1>
        <Ornament className="mt-6" />
        <p className="mt-5 text-sm text-ink/60">
          Enter your email and we'll send you a link to reset your password.
        </p>
      </header>
      <ForgotPasswordForm />
    </div>
  );
}