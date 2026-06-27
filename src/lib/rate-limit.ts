// Fixed-window rate limiter, keyed by an arbitrary id (usually the client IP).
// Used to blunt abuse of public POST endpoints (contact form, order creation) —
// quota burn, spam, scripted fake orders.
//
// Two backends, picked at runtime:
//   • Upstash Redis (durable, shared across instances) — used automatically
//     when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set. This is
//     the production path; it enforces the limit GLOBALLY across all serverless
//     instances. (Vercel KV exposes the same REST API — its env vars are
//     KV_REST_API_URL / KV_REST_API_TOKEN; map them to the names above, or add
//     them to the check below.)
//   • In-memory fallback — used when those env vars are absent (local dev, or
//     before you provision Redis). NOTE: on serverless this limits PER INSTANCE,
//     not globally — a speed bump, not a hard guarantee. Provision Upstash for
//     production-grade limiting.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
// Cap the Map so a flood of unique keys can't grow it without bound; once over
// the cap we sweep expired entries before inserting more.
const MAX_KEYS = 10_000;

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export type RateLimitResult = {
  ok: boolean;
  /** Requests left in the current window (0 when blocked). */
  remaining: number;
  /** Seconds until the window resets (for a Retry-After header). */
  retryAfter: number;
};

function sweepExpired(now: number) {
  for (const [key, b] of buckets) {
    if (now >= b.resetAt) buckets.delete(key);
  }
}

function memoryLimit(
  id: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(id);

  if (!existing || now >= existing.resetAt) {
    if (buckets.size >= MAX_KEYS) sweepExpired(now);
    buckets.set(id, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }
  if (existing.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfter: Math.ceil((existing.resetAt - now) / 1000),
    };
  }
  existing.count += 1;
  return { ok: true, remaining: limit - existing.count, retryAfter: 0 };
}

// One round-trip to Upstash: INCR the counter, set the window TTL only on the
// first hit (EXPIRE … NX), and read the remaining TTL — all atomically.
async function redisLimit(
  id: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const windowSec = Math.ceil(windowMs / 1000);
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", id],
      ["EXPIRE", id, windowSec, "NX"],
      ["PTTL", id],
    ]),
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Upstash ${res.status}`);

  // Pipeline returns results in order: [{result: count}, {…}, {result: pttlMs}]
  const data = (await res.json()) as { result: number }[];
  const count = Number(data[0]?.result ?? 0);
  const pttl = Number(data[2]?.result ?? 0);
  const retryAfter = pttl > 0 ? Math.ceil(pttl / 1000) : windowSec;

  if (count > limit) return { ok: false, remaining: 0, retryAfter };
  return { ok: true, remaining: Math.max(0, limit - count), retryAfter: 0 };
}

/**
 * Records one hit for `id` and reports whether it's within `limit` per
 * `windowMs`. Uses Upstash Redis when configured, else an in-memory window.
 * If Upstash errors, it fails over to the in-memory limiter rather than letting
 * the endpoint through unprotected.
 */
export async function rateLimit(
  id: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): Promise<RateLimitResult> {
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      return await redisLimit(id, limit, windowMs);
    } catch (err) {
      console.error("Rate limiter: Upstash unavailable, using memory:", err);
    }
  }
  return memoryLimit(id, limit, windowMs);
}

/**
 * Best-effort client IP from the proxy headers our host sets. Falls back to a
 * shared "unknown" bucket when no header is present (e.g. local dev) — that
 * groups anonymous callers together, which is the safe direction for a limiter.
 *
 * Security: never trust the LEFTMOST `x-forwarded-for` entry — a client can send
 * its own `X-Forwarded-For` header, so the leftmost value is attacker-controlled
 * and rotating it would mint a fresh limiter bucket per request (limiter bypass).
 * On Vercel the edge sets `x-real-ip` to the real client IP and overwrites any
 * client-supplied value, so we trust that first. The XFF fallback (non-Vercel /
 * other proxies) uses the LAST hop — the entry the nearest trusted proxy added —
 * rather than the spoofable first one.
 */
export function getClientIp(request: Request): string {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1]!;
  }
  return "unknown";
}

/** Builds a 429 JSON response with a Retry-After header. */
export function tooManyRequests(retryAfter: number, message: string) {
  return Response.json(
    { error: message },
    { status: 429, headers: { "Retry-After": String(Math.max(1, retryAfter)) } },
  );
}
