import "server-only";
// Cookie-bound session helpers + the admin authorization gate. Kept separate
// from auth.ts (pure crypto) because these import next/headers.
import { cookies } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  signSession,
  verifySessionToken,
  type SessionPayload,
} from "@/lib/auth";

// Writes the signed session cookie. Call only from a Server Action / Route
// Handler (cookies are read-only in Server Components).
export async function setSessionCookie(payload: Omit<SessionPayload, "exp">): Promise<void> {
  const exp = Date.now() + SESSION_TTL_MS;
  const store = await cookies();
  store.set(SESSION_COOKIE, signSession({ ...payload, exp }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(exp),
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

// Reads + verifies the session cookie. Memoized per request (React cache) so
// multiple components/actions in one render share a single verify. Returns the
// (tamper-proof) payload or null.
export const getSession = cache(async (): Promise<SessionPayload | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
});

// Authoritative admin gate — call at the top of EVERY admin page and EVERY
// admin Server Action (server actions are reachable by direct POST, so a layout
// check alone is not enough). Redirects non-admins to login.
export async function requireAdmin(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    redirect("/login?next=/admin");
  }
  return session;
}

// Any-signed-in-user gate for the customer account area. Redirects guests to
// login with a return path so they land back where they were headed.
export async function requireSession(next = "/account"): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  return session;
}