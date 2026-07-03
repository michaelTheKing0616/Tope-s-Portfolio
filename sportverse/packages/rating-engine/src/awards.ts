import type { DraftModeConfig } from "@sportverse/draftballer-types";
import type { PlayerSeasonStat } from "@sportverse/sports-db";

export interface PlayerAward {
  playerId: string;
  award: string;
  year: number;
  context: "club" | "international" | "both";
  bonus: number;
}

export interface IconicMoment {
  playerId: string;
  moment: string;
  context: "club" | "international" | "both";
  bonus: number;
}

let awardsCache: PlayerAward[] = [];
let momentsCache: IconicMoment[] = [];

export function setAwardsData(awards: PlayerAward[], moments: IconicMoment[]): void {
  awardsCache = awards;
  momentsCache = moments;
}

function lensAllows(context: PlayerAward["context"], lens: DraftModeConfig["ratingLens"]): boolean {
  if (lens === "club_only") return context === "club" || context === "both";
  if (lens === "international_only") return context === "international" || context === "both";
  return true;
}

/** Bible §4.3.1 AwardBonus — capped sum filtered by rating lens. */
export function awardBonus(playerId: string, lens: DraftModeConfig["ratingLens"]): number {
  const total = awardsCache
    .filter((a) => a.playerId === playerId && lensAllows(a.context, lens))
    .reduce((s, a) => s + a.bonus, 0);
  return Math.min(6, total);
}

/** Bible §4.3.1 BigMomentBonus — iconic moments lookup. */
export function bigMomentBonus(playerId: string, lens: DraftModeConfig["ratingLens"]): number {
  const total = momentsCache
    .filter((m) => m.playerId === playerId && lensAllows(m.context, lens))
    .reduce((s, m) => s + m.bonus, 0);
  return Math.min(4, total);
}

let legacyReputationCache: { playerId: string; tag: string; bonus: number; era: string }[] = [];

export function setLegacyReputationData(rows: { playerId: string; tag: string; bonus: number; era: string }[]): void {
  legacyReputationCache = rows;
}

/** Bounded ±5 legacy tag for pre-1980 sparse-data players (§5.1). */
export function legacyReputationBonus(playerId: string): number {
  const total = legacyReputationCache
    .filter((r) => r.playerId === playerId)
    .reduce((s, r) => s + r.bonus, 0);
  return Math.min(5, total);
}

/** Bible §4.3.1 LongevityAdjustment — sustained seasons (all-time / decade only). */
export function longevityAdjustment(stats: PlayerSeasonStat[], era: DraftModeConfig["era"]): number {
  if (era !== "all_time" && era !== "decade") return 0;
  const seasons = new Set(stats.filter((s) => s.appearances >= 15).map((s) => s.seasonLabel));
  if (seasons.size >= 12) return 3;
  if (seasons.size >= 8) return 2;
  if (seasons.size >= 5) return 1;
  return 0;
}
