/**
 * Format-level validation for Nigerian identity numbers.
 *
 * NOTE: These check *structure* only (length and digits). Authoritative
 * verification of a NIN or BVN requires the NIMC / NIBSS APIs — this module
 * deliberately stops at the boundary check so it stays offline, dependency-free
 * and safe to run client-side. Never treat a `true` here as proof of identity.
 */

const ELEVEN_DIGITS = /^\d{11}$/;

/** A National Identification Number is 11 digits. */
export function isValidNIN(value: string): boolean {
  return typeof value === "string" && ELEVEN_DIGITS.test(value.trim());
}

/** A Bank Verification Number is 11 digits. */
export function isValidBVN(value: string): boolean {
  return typeof value === "string" && ELEVEN_DIGITS.test(value.trim());
}

/**
 * Mask an 11-digit ID for display/logging, revealing only the last `visible`
 * digits. Never log full NIN/BVN values; use this instead.
 */
export function maskID(value: string, visible = 4): string {
  const trimmed = String(value).trim();
  if (!ELEVEN_DIGITS.test(trimmed)) throw new Error("maskID expects an 11-digit value");
  const keep = Math.max(0, Math.min(visible, 11));
  return `${"*".repeat(11 - keep)}${trimmed.slice(11 - keep)}`;
}
