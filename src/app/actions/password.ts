"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword, generateToken, hashToken } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { rateLimit, getClientIpFromHeaders } from "@/lib/rate-limit";
import { sendPasswordResetEmail } from "@/lib/email";

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

export type ChangePasswordState = { ok?: boolean; error?: string } | undefined;
export type ForgotState = { ok?: boolean; error?: string } | undefined;
export type ResetState = { error?: string } | undefined;

async function currentOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// ── Change password (signed in) ─────────────────────────────────────────────
export async function changePasswordAction(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const session = await getSession();
  if (!session) return { error: "You're not signed in." };

  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (next.length < 8) return { error: "New password must be at least 8 characters." };
  if (next !== confirm) return { error: "The new passwords don't match." };

  const customer = await prisma.customer.findUnique({ where: { id: session.sub } });
  if (!customer || !verifyPassword(current, customer.passwordHash)) {
    return { error: "Your current password is incorrect." };
  }
  if (verifyPassword(next, customer.passwordHash)) {
    return { error: "Choose a password different from your current one." };
  }

  await prisma.customer.update({
    where: { id: customer.id },
    data: { passwordHash: hashPassword(next) },
  });
  return { ok: true };
}

// ── Forgot password (request a reset link) ──────────────────────────────────
export async function forgotPasswordAction(_prev: ForgotState, formData: FormData): Promise<ForgotState> {
  const rl = await rateLimit(`forgot:${getClientIpFromHeaders(await headers())}`, {
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (!rl.ok) return { error: "Too many requests. Please wait a few minutes and try again." };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const customer = await prisma.customer.findUnique({ where: { email } });

  // Only send to a real login account, but ALWAYS report success — never reveal
  // whether an email is registered.
  if (customer?.passwordHash) {
    const { token, tokenHash } = generateToken();
    await prisma.passwordResetToken.create({
      data: { customerId: customer.id, tokenHash, expiresAt: new Date(Date.now() + RESET_TTL_MS) },
    });
    const origin = await currentOrigin();
    const link = `${origin}/reset-password?token=${token}`;
    await sendPasswordResetEmail(email, customer.name, link);
    // Dev convenience: no Resend key → surface the link in the server log.
    if (process.env.NODE_ENV !== "production" && !process.env.RESEND_API_KEY) {
      console.log(`[dev] Password reset link for ${email}: ${link}`);
    }
  }
  return { ok: true };
}

// ── Reset password (consume the emailed token) ──────────────────────────────
export async function resetPasswordAction(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const token = String(formData.get("token") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (!token) return { error: "This reset link is invalid." };
  if (next.length < 8) return { error: "Password must be at least 8 characters." };
  if (next !== confirm) return { error: "The passwords don't match." };

  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, customerId: true, expiresAt: true, usedAt: true },
  });
  if (!row || row.usedAt || row.expiresAt < new Date()) {
    return { error: "This reset link has expired or already been used. Please request a new one." };
  }

  // Set the new password, mark this token used, and drop the customer's other
  // outstanding reset tokens. A reset via emailed link proves ownership, so also
  // confirm the email if it wasn't already.
  await prisma.$transaction([
    prisma.customer.update({
      where: { id: row.customerId },
      data: { passwordHash: hashPassword(next), emailVerified: new Date() },
    }),
    prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    prisma.passwordResetToken.deleteMany({
      where: { customerId: row.customerId, usedAt: null },
    }),
  ]);

  redirect("/login?notice=reset-done");
}