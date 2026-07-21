import type { PlayerAttributes, Position } from "@sportverse/draftballer-types";
import { eaPrimeUplift } from "./ea-ratings.js";

export type HistoricalRatingSource =
  | "sofifa_csv_fc26"
  | "sofifa_history"
  | "legend_anchor"
  | "peak_mv_tier2"
  | "career_workload_tier3";

export interface HistoricalRatingEntry {
  playerId: string;
  peakOvr: number;
  source: HistoricalRatingSource | string;
  sofifaId?: number | null;
  name?: string;
  attributes?: PlayerAttributes;
  quizPosition?: Position;
  peakMv?: number;
  peakMvYear?: number;
  mvPercentile?: number;
  careerApps?: number;
  careerMinutes?: number;
}

let historicalIndex = new Map<string, HistoricalRatingEntry>();

export function setHistoricalRatingsIndex(entries: HistoricalRatingEntry[]): void {
  historicalIndex = new Map(entries.map((e) => [e.playerId, e]));
}

export function getHistoricalRating(playerId: string): HistoricalRatingEntry | undefined {
  return historicalIndex.get(playerId);
}

export function hasHistoricalRating(playerId: string): boolean {
  return historicalIndex.has(playerId);
}

/**
 * Apply a SoFIFA / peak-MV historical floor for players without EA or legend anchors.
 * Stats can still push above peak; peak prevents sub-70 squad players in prime modes.
 */
export function blendWithHistoricalCalibration(
  statsOvr: number,
  entry: HistoricalRatingEntry,
  opts: { eaCurrentSnapshot?: boolean } = {},
): { ovr: number; peakOvr: number; uplift: number; primeUplift: number } {
  const peakOvr = entry.peakOvr;
  if (opts.eaCurrentSnapshot) {
    return { ovr: statsOvr, peakOvr, uplift: 0, primeUplift: 0 };
  }

  const primeUplift = eaPrimeUplift(peakOvr, false);
  const floor = peakOvr + primeUplift;
  const statsAbovePeak = Math.max(0, statsOvr - peakOvr);
  const blended = Math.max(statsOvr, floor, peakOvr + Math.round(statsAbovePeak * 0.4));
  return {
    ovr: blended,
    peakOvr,
    uplift: Math.max(0, blended - statsOvr),
    primeUplift,
  };
}

/** Tier-2 MV share → prime OVR — mirrors build-historical-ratings-index.mjs */
export function peakMvToTier2Ovr(mvPct: number): number {
  if (mvPct <= 0) return 0;
  const raw = Math.round(58 + mvPct * 0.38);
  if (mvPct >= 40) return Math.min(91, Math.max(raw, 75));
  if (mvPct >= 25) return Math.min(88, Math.max(raw, 68));
  if (mvPct >= 15) return Math.min(84, Math.max(raw, 65));
  if (mvPct >= 8) return Math.min(78, Math.max(raw, 62));
  return 0;
}
