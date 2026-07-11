"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyPassword, DUMMY_PASSWORD_HASH, safeNext } from "@/lib/auth";
import { setSessionCookie, clearSessionCookie } from "@/lib/session";
import { rateLimit, getClientIpFromHeaders } from "@/lib/rate-limit";

// `unverified` lets the login form offer a "resend verification" action for a
// correct-but-unconfirmed customer account (carrying the email it was for).
export type LoginState = { error?: string; unverified?: boolean; email?: string } | undefined;

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  // Throttle credential stuffing: 10 attempts / 10 min per IP.
  const rl = await rateLimit(`login:${getClientIpFromHeaders(await headers())}`, {
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) return { error: "Too many attempts. Please wait a few minutes and try again." };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? ""));

  if (!email || !password) return { error: "Email and password are required." };

  const user = await prisma.customer.findUnique({ where: { email } });
  // Always run the scrypt comparison, even for a nonexistent account (against
  // a fixed dummy hash) — so this branch takes the same time either way and
  // can't be used to enumerate which emails are registered. Generic message
  // either way, for the same reason.
  const passwordOk = verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !passwordOk) {
    return { error: "Invalid email or password." };
  }

  // Customers must confirm their email before signing in. Staff/admin accounts
  // are provisioned internally (seed), so they're exempt from this gate.
  if (user.role === "CUSTOMER" && !user.emailVerified) {
    return {
      error: "Please verify your email before signing in — check your inbox for the link.",
      unverified: true,
      email,
    };
  }

  await setSessionCookie({ sub: user.id, role: user.role, email: user.email });
  redirect(next); // throws (control-flow) — nothing after runs
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/");
}