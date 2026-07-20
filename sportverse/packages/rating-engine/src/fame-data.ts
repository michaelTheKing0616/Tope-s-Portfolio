export interface FameRatingEntry {
  playerId: string;
  fameScore: number;
  peakMv?: number;
  peakMvYear?: number;
  durability?: number;
  /** Era-cohort peak MV percentile (0-100). Must NOT be derived from fameScore. */
  mvPercentile?: number;
}

let fameCache = new Map<string, FameRatingEntry>();

/** 5-year market era bucket. Unknown/missing year → cohort 0. */
export function mvEraBucket(year?: number): number {
  if (year == null || year < 1950 || year > 2100) return 0;
  return Math.floor(year / 5) * 5;
}

/**
 * Attach an MV "percentile" (0–100) as each player's **linear share of the
 * era-cohort top market value** — NOT a rank percentile. Rank percentiles are
 * fatally top-heavy here: cohorts contain tens of thousands of near-zero-MV
 * players, so a €40M journeyman ranked at the 99th percentile and the OVR
 * blend treated him like a €200M superstar (Ben Yedder at 94 OVR).
 * Linear share keeps discrimination where it matters: €40M vs €200M → 20.
 * FameScore is ignored — market value and fame are independent signals.
 *
 * Hand calc (same cohort): peakMv 1M / 20M / 100M → shares 1 / 20 / 100.
 */
export function attachMvPercentilesFromPeakMv(entries: FameRatingEntry[]): FameRatingEntry[] {
  const maxByBucket = new Map<number, number>();
  for (const e of entries) {
    if (e.peakMv == null || e.peakMv <= 0) continue;
    const bucket = mvEraBucket(e.peakMvYear);
    maxByBucket.set(bucket, Math.max(maxByBucket.get(bucket) ?? 0, e.peakMv));
  }

  return entries.map((e) => {
    if (e.peakMv == null || e.peakMv <= 0) {
      return { ...e, mvPercentile: e.mvPercentile ?? 0 };
    }
    const max = maxByBucket.get(mvEraBucket(e.peakMvYear)) ?? 0;
    const share = max > 0 ? (e.peakMv / max) * 100 : 0;
    return { ...e, mvPercentile: share };
  });
}

export function setFameDataForRatings(entries: FameRatingEntry[]): void {
  fameCache = new Map(entries.map((e) => [e.playerId, e]));
}

export function getFameRatingEntry(playerId: string): FameRatingEntry | undefined {
  return fameCache.get(playerId);
}

export function fameScoreForRating(playerId: string): number {
  return fameCache.get(playerId)?.fameScore ?? 0;
}

export function durabilityForRating(playerId: string): number {
  return fameCache.get(playerId)?.durability ?? 1;
}

/**
 * Market-value percentile for the labeled OVR blend.
 * Returns 0 when unknown — never falls back to fameScore (fame firewall).
 */
export function mvPercentileForRating(playerId: string): number {
  const e = fameCache.get(playerId);
  if (e?.mvPercentile == null || e.mvPercentile <= 0) return 0;
  return e.mvPercentile;
}
