/**
 * Nigerian phone number parsing, validation, normalisation and network
 * detection. Accepts the messy real-world formats users actually type
 * (+234, 234, 0-prefixed, spaces, dashes) and produces a single canonical form.
 */

export type Network = "MTN" | "Glo" | "Airtel" | "9mobile" | "Unknown";

/**
 * Allocated mobile prefixes by network (the 4 digits including the trunk `0`).
 * Kept as a data table so it is trivial to audit and extend as the NCC
 * reallocates ranges.
 */
const PREFIXES: Record<string, Network> = {
  // MTN
  "0703": "MTN", "0704": "MTN", "0706": "MTN",
  "0803": "MTN", "0806": "MTN", "0810": "MTN", "0813": "MTN", "0814": "MTN",
  "0816": "MTN", "0903": "MTN", "0906": "MTN", "0913": "MTN", "0916": "MTN",
  // Glo
  "0705": "Glo", "0805": "Glo", "0807": "Glo", "0811": "Glo", "0815": "Glo",
  "0905": "Glo", "0915": "Glo",
  // Airtel
  "0701": "Airtel", "0708": "Airtel", "0802": "Airtel", "0808": "Airtel",
  "0812": "Airtel", "0901": "Airtel", "0902": "Airtel", "0904": "Airtel",
  "0907": "Airtel", "0912": "Airtel",
  // 9mobile
  "0809": "9mobile", "0817": "9mobile", "0818": "9mobile",
  "0908": "9mobile", "0909": "9mobile",
};

export interface ParsedPhone {
  /** Canonical local form, 11 digits beginning with 0, e.g. "08031234567". */
  local: string;
  /** E.164 form, e.g. "+2348031234567". */
  e164: string;
  /** Detected mobile network, or "Unknown" for valid-but-unallocated prefixes. */
  network: Network;
}

/** Strip everything except digits, preserving order. */
function digitsOnly(input: string): string {
  return input.replace(/\D+/g, "");
}

/**
 * Reduce any accepted input to the 11-digit local form, or `null` if it cannot
 * be a Nigerian mobile number by length/shape alone.
 */
function toLocal(input: string): string | null {
  if (typeof input !== "string") return null;
  let d = digitsOnly(input);

  // International prefix variants → strip down to the national significant number.
  if (d.startsWith("234")) d = d.slice(3);
  else if (d.startsWith("00234")) d = d.slice(5);

  // At this point we want the 10-digit subscriber number (no trunk 0).
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length !== 10) return null;

  // Nigerian mobile subscriber numbers start with 7, 8 or 9.
  if (!/^[789]/.test(d)) return null;
  return `0${d}`;
}

/** True when the input is a structurally valid Nigerian mobile number. */
export function isValidPhone(input: string): boolean {
  return toLocal(input) !== null;
}

/** Detect the mobile network. Returns "Unknown" for unallocated prefixes. */
export function getNetwork(input: string): Network {
  const local = toLocal(input);
  if (!local) return "Unknown";
  return PREFIXES[local.slice(0, 4)] ?? "Unknown";
}

/**
 * Parse a number into its canonical forms + network, or `null` if invalid.
 * This is the main entry point; the helpers above are thin wrappers over it.
 */
export function parsePhone(input: string): ParsedPhone | null {
  const local = toLocal(input);
  if (!local) return null;
  return {
    local,
    e164: `+234${local.slice(1)}`,
    network: PREFIXES[local.slice(0, 4)] ?? "Unknown",
  };
}

/**
 * Normalise to a chosen format. Throws on invalid input so callers validating
 * at a boundary fail loudly rather than propagating bad data.
 */
export function formatPhone(input: string, style: "e164" | "local" = "e164"): string {
  const parsed = parsePhone(input);
  if (!parsed) throw new Error(`Invalid Nigerian phone number: ${String(input)}`);
  return style === "e164" ? parsed.e164 : parsed.local;
}
