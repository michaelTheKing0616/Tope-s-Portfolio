import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify Paystack webhook signature (HMAC SHA512 of raw body).
 * When PAYSTACK_SECRET is unset, verification is skipped (dev only).
 */
export function verifyPaystackSignature(
  rawBody: string,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!secret) return true; // dev mode — log warning at call site
  if (!signature) return false;
  const hash = createHmac("sha512", secret).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  } catch {
    return false;
  }
}
