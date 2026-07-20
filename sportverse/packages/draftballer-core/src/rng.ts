/** Mulberry32 PRNG — deterministic gameplay randomness from a string seed. */
export function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 343291835);
    h = (h << 13) | (h >>> 19);
  }
  return (h >>> 0) || 1;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SeededRng {
  next(): number;
  shuffle<T>(arr: T[]): T[];
  sample<T>(arr: T[], n: number): T[];
  weightedSample<T>(arr: T[], weight: (t: T) => number, n: number): T[];
}

export function createRng(seed: string): SeededRng {
  const next = mulberry32(hashSeed(seed));
  let counter = 0;

  const nextVal = () => {
    counter++;
    return next();
  };

  return {
    next: nextVal,
    shuffle<T>(arr: T[]): T[] {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(nextVal() * (i + 1));
        [a[i], a[j]] = [a[j]!, a[i]!];
      }
      return a;
    },
    sample<T>(arr: T[], n: number): T[] {
      return this.shuffle(arr).slice(0, Math.min(n, arr.length));
    },
    weightedSample<T>(arr: T[], weight: (t: T) => number, n: number): T[] {
      const pool = [...arr];
      const out: T[] = [];
      while (out.length < n && pool.length) {
        const total = pool.reduce((s, item) => s + Math.max(0.01, weight(item)), 0);
        let r = nextVal() * total;
        let picked = pool[0]!;
        for (const item of pool) {
          r -= Math.max(0.01, weight(item));
          if (r <= 0) {
            picked = item;
            break;
          }
        }
        out.push(picked);
        pool.splice(pool.indexOf(picked), 1);
      }
      return out;
    },
  };
}

export function dailyChallengeSeed(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `daily-${y}-${m}-${d}`;
}

export function randomSessionSeed(): string {
  return `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
