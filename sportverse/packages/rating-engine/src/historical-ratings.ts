import type { PlayerAttributes, Position } from "@sportverse/draftballer-types";
import type { PlayerSeasonStat } from "@sportverse/sports-db";
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

/** Top-flight + continental comps — mirrors build-historical-ratings-index.mjs */
export const TOP_FLIGHT_COMPETITIONS = new Set([
  "premier-league",
  "la-liga",
  "serie-a",
  "bundesliga",
  "ligue-1",
  "champions-league",
  "europa-league",
]);

const ESTABLISHED_SEASON_MIN_APPS = 15;

/** Map sustained top-league minutes/apps → prime floor for non-MV retirees. */
export function careerWorkloadToPeakOvr(apps: number, minutes: number): number {
  if (apps >= 150 || minutes >= 10_000) return 78;
  if (apps >= 100 || minutes >= 7000) return 75;
  if (apps >= 60 || minutes >= 4500) return 72;
  if (apps >= 30 || minutes >= 2000) return 68;
  if (apps >= 15 || minutes >= 900) return 65;
  return 0;
}

export function establishedCareerVolume(stats: PlayerSeasonStat[]): {
  topFlightSeasons: number;
  topFlightApps: number;
  topFlightMinutes: number;
} {
  let topFlightApps = 0;
  let topFlightMinutes = 0;
  const seasonApps = new Map<string, number>();
  for (const row of stats) {
    if (row.context !== "CLUB") continue;
    if (!TOP_FLIGHT_COMPETITIONS.has(row.competitionId)) continue;
    const apps = row.appearances ?? 0;
    topFlightApps += apps;
    topFlightMinutes += row.minutes ?? 0;
    if (apps > 0) {
      seasonApps.set(row.seasonLabel, (seasonApps.get(row.seasonLabel) ?? 0) + apps);
    }
  }
  const topFlightSeasons = [...seasonApps.values()].filter((a) => a >= ESTABLISHED_SEASON_MIN_APPS).length;
  return { topFlightSeasons, topFlightApps, topFlightMinutes };
}

/**
 * Conservative OVR floor for sustained top-flight professionals.
 * Returns 0 for fringe players; 64–68 scales with career length/volume.
 */
export function establishedProfessionalFloor(
  stats: PlayerSeasonStat[],
  histEntry?: HistoricalRatingEntry,
): number {
  const { topFlightSeasons, topFlightApps, topFlightMinutes } = establishedCareerVolume(stats);

  let floor = 0;
  if (topFlightSeasons >= 8 || topFlightApps >= 60) {
    floor = 64;
    if (topFlightSeasons >= 10 || topFlightApps >= 100 || topFlightMinutes >= 7000) floor = 67;
    if (topFlightSeasons >= 12 || topFlightApps >= 150 || topFlightMinutes >= 10_000) floor = 68;
  }

  if (histEntry?.source === "career_workload_tier3") {
    const workloadPeak = careerWorkloadToPeakOvr(
      histEntry.careerApps ?? topFlightApps,
      histEntry.careerMinutes ?? topFlightMinutes,
    );
    const tierFloor =
      workloadPeak >= 75 ? 68 : workloadPeak >= 72 ? 67 : workloadPeak >= 68 ? 66 : 64;
    floor = Math.max(floor, tierFloor);
  } else if (histEntry && (histEntry.peakOvr ?? 0) < 64) {
    floor = Math.max(floor, 64);
  }

  return floor;
}

function resolveHistoricalPeak(entry: HistoricalRatingEntry): number {
  let peak = entry.peakOvr;
  if (entry.source === "career_workload_tier3") {
    const fromWorkload = careerWorkloadToPeakOvr(entry.careerApps ?? 0, entry.careerMinutes ?? 0);
    peak = Math.max(peak, fromWorkload);
    if (fromWorkload > 0) peak = Math.max(peak, 64);
  }
  return peak;
}

function historicalPrimeUplift(entry: HistoricalRatingEntry, peakOvr: number): number {
  if (entry.source === "career_workload_tier3") {
    if (peakOvr >= 75) return 2;
    if (peakOvr >= 68) return 1;
    return 0;
  }
  return eaPrimeUplift(peakOvr, false);
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
  const peakOvr = resolveHistoricalPeak(entry);
  if (opts.eaCurrentSnapshot) {
    return { ovr: statsOvr, peakOvr, uplift: 0, primeUplift: 0 };
  }

  const primeUplift = historicalPrimeUplift(entry, peakOvr);
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
