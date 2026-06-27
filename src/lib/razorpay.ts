// Server-only Razorpay client. The key SECRET must never reach the browser —
// this module is imported solely from route handlers / server code.
import Razorpay from "razorpay";

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (!keyId || !keySecret) {
  throw new Error(
    "Razorpay keys missing — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env",
  );
}

export const razorpay = new Razorpay({
  key_id: keyId,
  key_secret: keySecret,
});

export const RAZORPAY_KEY_ID = keyId;
export const RAZORPAY_KEY_SECRET = keySecret;