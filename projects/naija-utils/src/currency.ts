/**
 * Naira money handling. Money is stored and computed in **kobo** (integer minor
 * units) to avoid floating-point drift, and only converted to a display string
 * at the edge — the same discipline a payments system should use.
 */

const KOBO_PER_NAIRA = 100;

/** Convert a naira amount (may be fractional) to integer kobo. */
export function nairaToKobo(naira: number): number {
  if (!Number.isFinite(naira)) throw new Error("nairaToKobo expects a finite number");
  // Round to the nearest kobo to absorb float representation error.
  return Math.round(naira * KOBO_PER_NAIRA);
}

/** Convert integer kobo back to a naira number. */
export function koboToNaira(kobo: number): number {
  if (!Number.isInteger(kobo)) throw new Error("koboToNaira expects an integer (kobo)");
  return kobo / KOBO_PER_NAIRA;
}

export interface FormatNairaOptions {
  /** Treat the input as kobo (integer minor units) rather than naira. */
  fromKobo?: boolean;
  /** Show the ₦ symbol (default true). */
  symbol?: boolean;
  /** Number of decimal places (default 2). */
  decimals?: number;
}

/**
 * Format an amount as Nigerian Naira, e.g. `formatNaira(186000)` → "₦186,000.00".
 * Uses Intl when available and falls back to a manual grouping otherwise.
 */
export function formatNaira(amount: number, options: FormatNairaOptions = {}): string {
  const { fromKobo = false, symbol = true, decimals = 2 } = options;
  const value = fromKobo ? koboToNaira(amount) : amount;
  if (!Number.isFinite(value)) throw new Error("formatNaira expects a finite amount");

  let body: string;
  try {
    body = new Intl.NumberFormat("en-NG", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  } catch {
    body = manualGroup(value, decimals);
  }
  return symbol ? `\u20A6${body}` : body;
}

function manualGroup(value: number, decimals: number): string {
  const negative = value < 0;
  const fixed = Math.abs(value).toFixed(decimals);
  const [whole = "0", frac] = fixed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const out = frac ? `${grouped}.${frac}` : grouped;
  return negative ? `-${out}` : out;
}
