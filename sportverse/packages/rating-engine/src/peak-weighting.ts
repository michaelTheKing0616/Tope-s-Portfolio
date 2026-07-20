import type { PlayerSeasonStat } from "@sportverse/sports-db";

/** Min appearances for a season to enter the peak window — UNCALIBRATED — EXPERT PRIOR.
 * Without this, 1-app cup braces (2 goals / 1 app) outrank real league campaigns. */
export const PEAK_SEASON_MIN_APPS = 10;

function seasonScore(row: PlayerSeasonStat): number {
  const apps = Math.max(1, row.appearances);
  const production = (row.goals / apps) * 3 + (row.assists / apps) * 2 + Math.min(apps, 40) / 40;
  // Sample reliability: full seasons dominate cup cameos.
  const sample = Math.min(1, apps / 20);
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

/** Bible §4.5 — weight top-N seasons by production score (all-time / decade modes). */
export function peakWeightStats(stats: PlayerSeasonStat[], n = 4): PlayerSeasonStat[] {
  if (stats.length <= n) return stats;

  const merged = mergeGroups(stats);
  const eligible = merged.filter((r) => r.appearances >= PEAK_SEASON_MIN_APPS);
  const pool = eligible.length >= Math.min(2, n) ? eligible : merged;
  const ranked = [...pool].sort((a, b) => seasonScore(b) - seasonScore(a));
  return ranked.slice(0, n);
}
