import type { PlayerSeasonStat } from "@sportverse/sports-db";
import type { Position } from "@sportverse/draftballer-types";

/** Min appearances for a season to enter the peak window — UNCALIBRATED — EXPERT PRIOR.
 * Without this, 1-app cup braces (2 goals / 1 app) outrank real league campaigns. */
export const PEAK_SEASON_MIN_APPS = 10;

const DEFENSIVE_ROLES = new Set<Position>(["CB", "FB", "DM", "GK"]);

/**
 * Peak-season score. Attackers still reward goal/assist production;
 * defenders/keepers are scored on workload (apps + minutes) so fullbacks
 * aren't crushed by a 0 G/A season.
 */
export function seasonScore(row: PlayerSeasonStat, position?: Position): number {
  const apps = Math.max(1, row.appearances);
  const minutes = Math.max(0, row.minutes);
  const sample = Math.min(1, apps / 20);

  if (position && DEFENSIVE_ROLES.has(position)) {
    const appsScore = Math.min(apps, 40) / 40;
    const minsScore = Math.min(minutes, 3200) / 3200;
    const lightProd = (row.goals / apps) * 0.4 + (row.assists / apps) * 0.7;
    const workload = appsScore * 2.2 + minsScore * 2.0 + lightProd;
    return workload * (0.4 + 0.6 * sample);
  }

  const production = (row.goals / apps) * 3 + (row.assists / apps) * 2 + Math.min(apps, 40) / 40;
  return production * (0.35 + 0.65 * sample);
}

function groupKey(row: PlayerSeasonStat): string {
  return `${row.seasonLabel}|${row.competitionId}|${row.context}`;
}

function mergeGroups(stats: PlayerSeasonStat[]): PlayerSeasonStat[] {
  const groups = new Map<string, PlayerSeasonStat>();
  for (const row of stats) {
    const key = groupKey(row);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { ...row });
      continue;
    }
    existing.appearances += row.appearances;
    existing.goals += row.goals;
    existing.assists += row.assists;
    existing.minutes += row.minutes;
    existing.confidence = Math.max(existing.confidence, row.confidence);
    if (row.clubName && !existing.clubName) existing.clubName = row.clubName;
  }
  return [...groups.values()];
}

/** Bible §4.5 — weight top-N seasons by production/workload score. */
export function peakWeightStats(
  stats: PlayerSeasonStat[],
  n = 4,
  position?: Position,
): PlayerSeasonStat[] {
  if (stats.length <= n) return stats;

  const merged = mergeGroups(stats);
  const eligible = merged.filter((r) => r.appearances >= PEAK_SEASON_MIN_APPS);
  const pool = eligible.length >= Math.min(2, n) ? eligible : merged;
  const ranked = [...pool].sort((a, b) => seasonScore(b, position) - seasonScore(a, position));
  return ranked.slice(0, n);
}
