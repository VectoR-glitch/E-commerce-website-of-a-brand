import "server-only";
// Cloudflare R2 (S3-compatible) object storage for product images. The DB stores
// only the public URL; the binary lives here. Server-only — credentials must
// never reach the browser. Env is read lazily so a missing var fails at the
// upload call with a clear message, not at import/build.
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { randomBytes } from "node:crypto";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set — configure Cloudflare R2 in .env.`);
  return v;
}

let cached: S3Client | null = null;
function client(): S3Client {
  if (cached) return cached;
  cached = new S3Client({
    region: "auto",
    endpoint: `https://${env("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env("R2_ACCESS_KEY_ID"),
      secretAccessKey: env("R2_SECRET_ACCESS_KEY"),
    },
  });
  return cached;
}

const publicBase = () => env("R2_PUBLIC_URL").replace(/\/$/, "");

export function publicUrl(key: string): string {
  return `${publicBase()}/${key}`;
}

/** Reverse of publicUrl — the object key for a stored URL (null if it isn't ours). */
export function keyFromUrl(url: string): string | null {
  const base = publicBase();
  return url.startsWith(`${base}/`) ? url.slice(base.length + 1) : null;
}

const ALLOWED_IMAGE_TYPES = ["image/webp", "image/jpeg", "image/png", "image/avif"];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

export function isAllowedImage(type: string, size: number): boolean {
  return ALLOWED_IMAGE_TYPES.includes(type) && size > 0 && size <= MAX_IMAGE_BYTES;
}

/** Uploads a buffer under `prefix/` with a random, sanitized key; returns its public URL. */
export async function uploadToR2(opts: {
  prefix: string;
  filename: string;
  body: Buffer;
  contentType: string;
}): Promise<string> {
  const safe = opts.filename
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "image";
  const key = `${opts.prefix}/${randomBytes(6).toString("hex")}-${safe}`;
  await client().send(
    new PutObjectCommand({
      Bucket: env("R2_BUCKET"),
      Key: key,
      Body: opts.body,
      ContentType: opts.contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return publicUrl(key);
}

/** Best-effort delete by public URL; no-op if the URL isn't an R2 object of ours. */
export async function deleteFromR2(url: string): Promise<void> {
  const key = keyFromUrl(url);
  if (!key) return;
  await client().send(new DeleteObjectCommand({ Bucket: env("R2_BUCKET"), Key: key }));
}