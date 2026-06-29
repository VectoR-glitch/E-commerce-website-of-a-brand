"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth";
import { setSessionCookie, clearSessionCookie } from "@/lib/session";
import { rateLimit, getClientIpFromHeaders } from "@/lib/rate-limit";

export type LoginState = { error?: string } | undefined;

// Only allow same-origin internal redirect targets (prevents open-redirect via
// a crafted ?next=https://evil.com).
function safeNext(next: string): string {
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

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
  // Generic message — never reveal whether an email is registered.
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { error: "Invalid email or password." };
  }

  await setSessionCookie({ sub: user.id, role: user.role, email: user.email });
  redirect(next); // throws (control-flow) — nothing after runs
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/");
}