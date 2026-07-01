import "server-only";
// Self-owned auth primitives — no external auth dependency. Two concerns:
//   1. Password hashing (scrypt, per-user salt) — for login credentials.
//   2. Stateless session tokens (HMAC-signed, tamper-proof) — for the cookie.
// Both use node:crypto; this module is server-only and never reaches the browser.
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "klenich_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ── One-time tokens (email verification, password reset) ─────────────────────
// The raw token goes in the emailed link; only its SHA-256 hash is stored, so a
// leaked DB row can't be replayed as a valid link. Lookups hash the incoming
// token and match on the stored hash.
export function generateToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type Role = "CUSTOMER" | "STAFF" | "ADMIN";
export type SessionPayload = {
  sub: string; // customer id
  role: Role;
  email: string;
  exp: number; // epoch ms
};

// Read the signing secret lazily so a missing env var fails at request time
// (with a clear message) rather than crashing module import / the build.
function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error("AUTH_SECRET is missing or too short (set a 32+ char random string).");
  }
  return s;
}

// ── Passwords ──────────────────────────────────────────────────────────────
// Stored as `scrypt$<saltHex>$<hashHex>`. scrypt is deliberately slow + salted.
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false; // guest/order-only rows have no password → no login
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// ── Session tokens ────────────────────────────────────────────────────────
// Format: base64url(payloadJSON).base64url(HMAC-SHA256(payload, secret)).
// The HMAC makes the cookie tamper-proof, so we can trust the role it carries
// without a DB round-trip on every request.
function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export function signSession(payload: SessionPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data)}`;
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = sign(data);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as SessionPayload;
    if (!payload.exp || Date.now() > payload.exp) return null; // expired
    return payload;
  } catch {
    return null;
  }
}