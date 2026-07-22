/**
 * Layer 2 chance / xG helpers.
 * Score targets stay Dixon–Coles (Layer 1); this shapes when chances become goals
 * and what the spectator feels — without free-running goal totals.
 */

import type { Rng } from "./rng.js";

export interface MatchPhaseStats {
  possessionHomePhases: number;
  possessionAwayPhases: number;
  xGHome: number;
  xGAway: number;
  shotsHome: number;
  shotsAway: number;
  bigChancesHome: number;
  bigChancesAway: number;
  chancesHome: number;
  chancesAway: number;
}

export function emptyPhaseStats(): MatchPhaseStats {
  return {
    possessionHomePhases: 0,
    possessionAwayPhases: 0,
    xGHome: 0,
    xGAway: 0,
    shotsHome: 0,
    shotsAway: 0,
    bigChancesHome: 0,
    bigChancesAway: 0,
    chancesHome: 0,
    chancesAway: 0,
  };
}

/** Spread goal minutes across the half so late injects are rare. */
export function scheduleGoalMinutes(goalCount: number, rng: Rng): number[] {
  const minutes: number[] = [];
  for (let i = 0; i < goalCount; i++) {
    // Soft preference: openers early-middle, winners late, never all at 89'.
    const roll = rng();
    let m: number;
    if (roll < 0.28) m = 8 + Math.floor(rng() * 28); // 8–35
    else if (roll < 0.62) m = 36 + Math.floor(rng() * 24); // 36–59
    else if (roll < 0.88) m = 60 + Math.floor(rng() * 22); // 60–81
    else m = 82 + Math.floor(rng() * 7); // 82–88
    minutes.push(Math.min(88, Math.max(6, m)));
  }
  return minutes.sort((a, b) => a - b);
}

export function isBigChance(xg: number): boolean {
  return xg >= 0.32;
}

/**
 * Hidden chance quality from attack/defense gap + zone/momentum.
 * Returns xG in ~0.04–0.72 (player never sees the number — only the story).
 */
export function sampleChanceXg(opts: {
  attack: number;
  defense: number;
  gk: number;
  zoneMod: number;
  momentumBoost: number;
  identityBias: number;
  rng: Rng;
}): number {
  const raw =
    0.08 +
    Math.max(-12, Math.min(18, opts.attack * opts.momentumBoost - opts.defense * 0.55 - opts.gk * 0.35)) /
      55 +
    opts.zoneMod * 0.12 +
    opts.identityBias +
    (opts.rng() - 0.5) * 0.1;
  return Math.max(0.04, Math.min(0.72, raw));
}

/** Trailing side pushes — higher line, more shots, more variance (football psychology). */
export function chaseIntensity(goalDiffForTeam: number, minute: number): number {
  if (goalDiffForTeam >= 0) {
    // Protecting a lead late — slightly more conservative
    if (minute >= 75 && goalDiffForTeam > 0) return -0.04;
    return 0;
  }
  const deficit = Math.min(3, -goalDiffForTeam);
  const late = minute >= 70 ? 1.25 : minute >= 55 ? 1.1 : 1;
  return deficit * 0.06 * late;
}

export function identityChanceBias(identity: string): number {
  switch (identity) {
    case "high_press":
      return 0.03;
    case "counter":
      return 0.025;
    case "possession":
      return 0.01;
    case "route_one":
      return 0.02;
    default:
      return 0;
  }
}

export function summarizeMatchStats(stats: MatchPhaseStats): {
  possessionHome: number;
  possessionAway: number;
  xGHome: number;
  xGAway: number;
  shotsHome: number;
  shotsAway: number;
  bigChancesHome: number;
  bigChancesAway: number;
} {
  const total = Math.max(1, stats.possessionHomePhases + stats.possessionAwayPhases);
  return {
    possessionHome: Math.round((stats.possessionHomePhases / total) * 100),
    possessionAway: Math.round((stats.possessionAwayPhases / total) * 100),
    xGHome: Math.round(stats.xGHome * 100) / 100,
    xGAway: Math.round(stats.xGAway * 100) / 100,
    shotsHome: stats.shotsHome,
    shotsAway: stats.shotsAway,
    bigChancesHome: stats.bigChancesHome,
    bigChancesAway: stats.bigChancesAway,
  };
}

/** Pull next scheduled goal minute ≤ current minute, if any remain. */
export function dueGoalSlot(slots: number[], minute: number): boolean {
  return slots.length > 0 && slots[0]! <= minute + 2;
}

export function consumeGoalSlot(slots: number[]): void {
  if (slots.length) slots.shift();
}
