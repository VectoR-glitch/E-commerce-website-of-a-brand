// Newsletter signup — Resend Audience sync. No-ops safely when RESEND_API_KEY
// or RESEND_AUDIENCE_ID is absent, same pattern as email.ts, so the signup
// form still works (DB row saved) even before Resend is fully configured.
import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const audienceId = process.env.RESEND_AUDIENCE_ID;
const resend = apiKey ? new Resend(apiKey) : null;

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
