/** Money is always integer kobo — never floats. */

export function nairaToKobo(naira: number): number {
  if (!Number.isFinite(naira)) throw new Error("nairaToKobo expects a finite number");
  return Math.round(naira * 100);
}

export function koboToNaira(kobo: number): number {
  if (!Number.isInteger(kobo)) throw new Error("koboToNaira expects integer kobo");
  return kobo / 100;
}

export function formatNaira(kobo: number): string {
  if (!Number.isInteger(kobo)) throw new Error("formatNaira expects integer kobo");
  const naira = kobo / 100;
  const body = new Intl.NumberFormat("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(naira);
  return `\u20A6${body}`;
}

export function sumKobo(amounts: number[]): number {
  return amounts.reduce((a, b) => {
    if (!Number.isInteger(b)) throw new Error("sumKobo expects integer kobo amounts");
    return a + b;
  }, 0);
}
