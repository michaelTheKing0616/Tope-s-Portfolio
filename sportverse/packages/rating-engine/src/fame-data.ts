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
 * Rank players by peakMv **within era cohorts** and attach percentiles (0–100).
 * Global ranking made mid-career €10M look like elite MV (93rd %ile); era cohorts fix that.
 * FameScore is ignored — market value and fame are independent signals.
 *
 * Hand calc (same cohort): peakMv 1M / 20M / 100M → percentiles 0 / 50 / 100.
 */
export function attachMvPercentilesFromPeakMv(entries: FameRatingEntry[]): FameRatingEntry[] {
  const groups = new Map<number, FameRatingEntry[]>();
  for (const e of entries) {
    if (e.peakMv == null || e.peakMv <= 0) continue;
    const bucket = mvEraBucket(e.peakMvYear);
    const list = groups.get(bucket) ?? [];
    list.push(e);
    groups.set(bucket, list);
  }

  const pctById = new Map<string, number>();
  for (const list of groups.values()) {
    list.sort((a, b) => (a.peakMv ?? 0) - (b.peakMv ?? 0));
    const denom = Math.max(1, list.length - 1);
    for (let i = 0; i < list.length; i++) {
      pctById.set(list[i]!.playerId, (i / denom) * 100);
    }
  }

  return entries.map((e) => ({
    ...e,
    mvPercentile: pctById.get(e.playerId) ?? e.mvPercentile ?? 0,
  }));
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
