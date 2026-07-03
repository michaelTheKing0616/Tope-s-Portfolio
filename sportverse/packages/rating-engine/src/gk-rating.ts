import type { GKAttributes } from "@sportverse/draftballer-types";
import type { PlayerSeasonStat } from "@sportverse/sports-db";

function clamp(n: number): number {
  return Math.max(1, Math.min(99, Math.round(n)));
}

/** GK alternate attribute set — DIV/HAN/KIC/REF/SPD/POS (§KNOWN_SIMPLIFICATIONS fix). */
export function gkAttributesFromStats(stats: PlayerSeasonStat[]): GKAttributes | null {
  const rows = stats.filter((s) => s.appearances > 0);
  if (!rows.length) return null;

  const apps = rows.reduce((s, r) => s + r.appearances, 0);
  const minutes = rows.reduce((s, r) => s + r.minutes, 0);
  const goalsConceded = rows.reduce((s, r) => s + (r.goalsConceded ?? r.goalsAgainst ?? 0), 0);
  const mpg = minutes / apps;
  const csRate = Math.max(0, 1 - goalsConceded / Math.max(apps * 1.2, 1));

  const base = clamp(55 + mpg / 4);
  return {
    div: clamp(base + csRate * 12),
    han: clamp(base + 4 + csRate * 8),
    kic: clamp(50 + mpg / 8),
    ref: clamp(base + 6 + csRate * 10),
    spd: clamp(45 + mpg / 10),
    pos: clamp(base + csRate * 14),
  };
}

export function gkOvrFromAttributes(gk: GKAttributes): number {
  return clamp(
    gk.div * 0.24 +
      gk.han * 0.22 +
      gk.pos * 0.22 +
      gk.ref * 0.22 +
      gk.spd * 0.06 +
      gk.kic * 0.04,
  );
}
