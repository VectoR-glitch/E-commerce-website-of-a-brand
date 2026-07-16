"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { hashPassword, generateToken, MAX_PASSWORD_LENGTH, safeNext } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { rateLimit, getClientIpFromHeaders } from "@/lib/rate-limit";
import { sendVerificationEmail } from "@/lib/email";
import { resolveReferralCode } from "@/lib/loyalty";
import { INDIAN_STATES } from "@/lib/constants";
import { upsertDefaultAddress } from "@/lib/address";

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export type RegisterState = { error?: string } | undefined;
export type ResendState = { ok?: boolean; error?: string } | undefined;
export type ProfileState = { ok?: boolean; error?: string } | undefined;
export type AddressState = { ok?: boolean; error?: string } | undefined;

// Builds an absolute URL on the CURRENT origin (localhost in dev, the real host
// in prod) so emailed links always point at the right place — NEVER the static
// SITE_URL default, which would break dev verification links.
async function originFromHeaders(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// Issues a fresh verification token and emails the link. Old tokens are left in
// place (they simply expire) so a resend never invalidates a link already sent.
// `next` (e.g. "/checkout") is embedded in the emailed link itself — it's the
// only way to carry a post-signup destination across the redirect chain
// (register -> verify-email link, clicked from the customer's inbox -> login).
async function issueVerification(
  customerId: string,
  email: string,
  name: string | null,
  next?: string,
): Promise<void> {
  const { token, tokenHash } = generateToken();
  await prisma.verificationToken.create({
    data: { customerId, tokenHash, expiresAt: new Date(Date.now() + VERIFY_TTL_MS) },
  });
  const origin = await originFromHeaders();
  const nextParam = next && next !== "/" ? `&next=${encodeURIComponent(next)}` : "";
  const link = `${origin}/verify-email?token=${token}${nextParam}`;
  // Best-effort: the token is already saved, so a Resend outage/hiccup here
  // must not crash registerAction/resendVerificationAction into a raw error
  // page — the customer's account (registerAction) or the "check your inbox"
  // response (both callers) must still go through cleanly. They can always
  // retry via "resend verification" once the provider recovers.
  try {
    await sendVerificationEmail(email, name, link);
  } catch (err) {
    console.error(`Verification email failed for ${email}:`, err);
  }
  // Dev convenience: with no Resend key the email can't send, so surface the
  // link in the server log to complete the flow locally.
  if (process.env.NODE_ENV !== "production" && !process.env.RESEND_API_KEY) {
    console.log(`[dev] Verification link for ${email}: ${link}`);
  }
}

export async function registerAction(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
  const rl = await rateLimit(`register:${getClientIpFromHeaders(await headers())}`, {
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) return { error: "Too many attempts. Please wait a few minutes and try again." };

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const phone = String(formData.get("phone") ?? "").trim();
  const line1 = String(formData.get("line1") ?? "").trim();
  const line2 = String(formData.get("line2") ?? "").trim() || null;
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const pincode = String(formData.get("pincode") ?? "").trim();
  const next = safeNext(String(formData.get("next") ?? ""));

  if (!name) return { error: "Please enter your name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password.length > MAX_PASSWORD_LENGTH) return { error: `Password must be ${MAX_PASSWORD_LENGTH} characters or fewer.` };
  if (!/^[6-9]\d{9}$/.test(phone)) return { error: "Enter a valid 10-digit mobile number." };
  if (!line1) return { error: "Enter your address (line 1)." };
  if (!city) return { error: "Enter your city / town." };
  if (!INDIAN_STATES.includes(state)) return { error: "Select a valid state." };
  if (!/^\d{6}$/.test(pincode)) return { error: "Enter a valid 6-digit pincode." };

  const existing = await prisma.customer.findUnique({ where: { email } });
  if (existing?.passwordHash) {
    // Already a login account — don't create a second. (Generic-ish, but a
    // duplicate email is not a secret, and this is more helpful than failing.)
    return { error: "An account with this email already exists. Try signing in instead." };
  }

  // Referral attribution: if they arrived via a friend's link, stamp who
  // referred them (never themselves). Both sides are rewarded on this account's
  // first DELIVERED order (see awardLoyaltyForDeliveredOrder).
  const referredByRaw = String(formData.get("ref") ?? "");
  const referrerId = referredByRaw ? await resolveReferralCode(referredByRaw) : null;

  const passwordHash = hashPassword(password);
  const customer = existing
    ? // A guest/order-only row for this email exists → upgrade it to a login
      // account, preserving any orders already attached to it.
      await prisma.customer.update({
        where: { id: existing.id },
        data: {
          name,
          phone,
          passwordHash,
          role: "CUSTOMER",
          // Only attribute if not already referred and it isn't a self-referral.
          ...(referrerId && referrerId !== existing.id && !existing.referredById
            ? { referredById: referrerId }
            : {}),
        },
      })
    : await prisma.customer.create({
        data: { name, email, phone, passwordHash, role: "CUSTOMER", referredById: referrerId },
      });

  // Save the address given at signup as the default shipping address, so
  // checkout's prefill picks it up immediately — a guest/order-only row
  // upgrading here may already have one (unlikely, but handled the same way
  // for safety).
  await upsertDefaultAddress(customer.id, { line1, line2, city, state, pincode, phone });

  await issueVerification(customer.id, email, name, next);

  // Not signed in yet — email must be confirmed first. Send them to login with
  // a "check your inbox" notice, carrying `next` in case they navigate back to
  // login directly instead of clicking the emailed link.
  redirect(`/login?notice=verify-sent${next !== "/" ? `&next=${encodeURIComponent(next)}` : ""}`);
}

export async function resendVerificationAction(_prev: ResendState, formData: FormData): Promise<ResendState> {
  const rl = await rateLimit(`resend-verify:${getClientIpFromHeaders(await headers())}`, {
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) return { error: "Too many requests. Please wait a few minutes and try again." };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = safeNext(String(formData.get("next") ?? ""));
  const customer = await prisma.customer.findUnique({ where: { email } });
  // Only (re)send for an unverified customer login account. Always report the
  // same success — never reveal whether an email is registered/verified.
  if (customer && customer.passwordHash && customer.role === "CUSTOMER" && !customer.emailVerified) {
    await issueVerification(customer.id, email, customer.name, next);
  }
  return { ok: true };
}

// Updates the signed-in customer's profile (name + phone). Email is the login
// identity and isn't editable here. Authorizes via the session (server actions
// are POST-reachable, so this can't rely on the page guard alone).
export async function updateProfileAction(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const session = await getSession();
  if (!session) return { error: "You're not signed in." };

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  if (!name) return { error: "Name can't be empty." };
  if (phone && !/^[6-9]\d{9}$/.test(phone)) {
    return { error: "Enter a valid 10-digit mobile, or leave it blank." };
  }

  await prisma.customer.update({ where: { id: session.sub }, data: { name, phone } });
  revalidatePath("/account");
  return { ok: true };
}

// Saves the signed-in customer's default shipping address (one box on /account).
// Upserts the single default row: updates it if present, otherwise creates it.
// Authorizes via the session — server actions are POST-reachable, so the page
// guard alone is not a boundary.
export async function saveAddressAction(_prev: AddressState, formData: FormData): Promise<AddressState> {
  const session = await getSession();
  if (!session) return { error: "You're not signed in." };

  const line1 = String(formData.get("line1") ?? "").trim();
  const line2 = String(formData.get("line2") ?? "").trim() || null;
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const pincode = String(formData.get("pincode") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;

  if (!line1) return { error: "Enter your address (line 1)." };
  if (!city) return { error: "Enter your city / town." };
  if (!INDIAN_STATES.includes(state)) return { error: "Select a valid state." };
  if (!/^\d{6}$/.test(pincode)) return { error: "Enter a valid 6-digit pincode." };
  if (phone && !/^[6-9]\d{9}$/.test(phone)) {
    return { error: "Enter a valid 10-digit mobile, or leave it blank." };
  }

  await upsertDefaultAddress(session.sub, { line1, line2, city, state, pincode, phone });

  revalidatePath("/account");
  return { ok: true };
}