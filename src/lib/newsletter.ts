// Newsletter signup — Resend Audience sync + welcome coupon. No-ops safely
// when RESEND_API_KEY or RESEND_AUDIENCE_ID is absent, same pattern as
// email.ts, so the signup form still works (DB row saved) even before Resend
// is fully configured.
import { randomBytes } from "node:crypto";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";

const apiKey = process.env.RESEND_API_KEY;
const audienceId = process.env.RESEND_AUDIENCE_ID;
const resend = apiKey ? new Resend(apiKey) : null;

const WELCOME_DISCOUNT_PERCENT = 10;

function generateWelcomeCode() {
  return `WELCOME10-${randomBytes(4).toString("hex").slice(0, 6).toUpperCase()}`;
}

// Mints a single-use (maxUses: 1), 10%-off coupon for a new newsletter
// subscriber — "1 purchase per account" is enforced by the code being
// unique-per-signup and single-use, not by tying it to a logged-in customer
// (checkout doesn't require an account, so a customerId-scoped coupon would
// silently fail to help most guest checkouts). Retries on the astronomically
// unlikely event of a code collision. Returns null (never throws) if it can't
// mint one — the newsletter signup itself must still succeed either way.
export async function createWelcomeCoupon(): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateWelcomeCode();
    try {
      await prisma.coupon.create({
        data: { code, type: "PERCENT", value: WELCOME_DISCOUNT_PERCENT, maxUses: 1 },
      });
      return code;
    } catch (err) {
      // Unique constraint on `code` — collide and retry; anything else, give up.
      const isUniqueClash =
        typeof err === "object" && err !== null && "code" in err && err.code === "P2002";
      if (!isUniqueClash) {
        console.error("Welcome coupon creation failed:", err);
        return null;
      }
    }
  }
  console.error("Welcome coupon creation failed: exhausted retries on code collisions.");
  return null;
}

// Adds (or re-activates, if previously unsubscribed) a contact in the Klenich
// Newsletter audience. Returns the Resend contact id on success, or null if
// Resend isn't configured or the call failed — callers should still treat the
// signup itself as successful (the DB row is the source of truth) and just
// log the sync failure rather than surface it to the user.
export async function syncNewsletterContact(email: string): Promise<string | null> {
  if (!resend || !audienceId) return null;
  try {
    const result = await resend.contacts.create({ email, audienceId, unsubscribed: false });
    if (result.error) {
      console.error("Resend contact sync failed:", result.error);
      return null;
    }
    return result.data?.id ?? null;
  } catch (err) {
    console.error("Resend contact sync failed:", err);
    return null;
  }
}
