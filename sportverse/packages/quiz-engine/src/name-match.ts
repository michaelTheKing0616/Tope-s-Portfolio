/** Normalize for comparison: lowercase, strip accents, trim. */
export function normalizeAnswer(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLowerCase();
}

const NAME_PARTICLES = new Set([
  "van",
  "von",
  "de",
  "da",
  "di",
  "del",
  "la",
  "le",
  "dos",
  "do",
  "der",
  "den",
  "el",
  "al",
]);

const SUFFIXES = new Set(["jr", "sr", "ii", "iii"]);

function splitNameParts(name: string): string[] {
  return normalizeAnswer(name)
    .split(/[\s\-]+/)
    .map((p) => p.replace(/[^a-z0-9']/g, ""))
    .filter((p) => p.length > 0);
}

function isSignificantPart(part: string): boolean {
  return part.length >= 2 && !NAME_PARTICLES.has(part) && !SUFFIXES.has(part);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const next = Math.min(row[j]! + 1, prev + 1, row[j - 1]! + cost);
      row[j - 1] = prev;
      prev = next;
    }
    row[b.length] = prev;
  }
  return row[b.length]!;
}

/** Allow minor typos; reject clearly wrong spellings. */
export function maxEditDistance(length: number): number {
  if (length <= 3) return 0;
  if (length <= 6) return 1;
  if (length <= 10) return 2;
  return 2;
}

export function fuzzyNameEquals(a: string, b: string): boolean {
  const left = normalizeAnswer(a);
  const right = normalizeAnswer(b);
  if (!left || !right) return false;
  if (left === right) return true;

  const distance = levenshtein(left, right);
  const allowed = maxEditDistance(Math.max(left.length, right.length));
  return distance <= allowed;
}

/**
 * Who Am I? — correct if the guess matches the full name OR at least one
 * significant name part (first/last) with fuzzy spelling tolerance.
 */
export function whoAmIGuessMatches(playerName: string, guess: string): boolean {
  const expectedParts = splitNameParts(playerName);
  const guessParts = splitNameParts(guess);
  if (!expectedParts.length || !guessParts.length) return false;

  const normExpected = normalizeAnswer(playerName);
  const normGuess = normalizeAnswer(guess);
  if (fuzzyNameEquals(normExpected, normGuess)) return true;

  const significantExpected = expectedParts.filter(isSignificantPart);
  const significantGuess = guessParts.filter(isSignificantPart);
  if (!significantExpected.length || !significantGuess.length) return false;

  for (const g of significantGuess) {
    for (const e of significantExpected) {
      if (fuzzyNameEquals(g, e)) return true;
    }
  }

  return false;
}
