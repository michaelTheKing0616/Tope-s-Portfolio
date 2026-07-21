import type { RatedPlayerCard } from "@sportverse/draftballer-types";

/** Target completed-XI average OVR — wheel draft nudges picks toward this. */
export const SQUAD_TARGET_AVG_OVR = 72;
/** Completed squads below this avg are treated as a weak outcome (rare after nudges). */
export const SQUAD_WEAK_AVG_OVR = 68;
/** No single starter in a completed XI should land below this if alternatives existed. */
export const SQUAD_MIN_STARTER_OVR = 62;

export type SquadQualityBand = "strong" | "on_track" | "at_risk" | "weak";

export interface SquadQualitySnapshot {
  avgOvr: number;
  minOvr: number;
  maxOvr: number;
  filled: number;
  squadSize: number;
  picksRemaining: number;
  /** Minimum OVR that keeps the XI on pace for SQUAD_TARGET_AVG_OVR. */
  targetMinPickOvr: number;
  band: SquadQualityBand;
  needsQualityBoost: boolean;
}

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function squadQualityBand(avgOvr: number, picksRemaining: number): SquadQualityBand {
  if (picksRemaining === 0) {
    if (avgOvr >= SQUAD_TARGET_AVG_OVR) return "strong";
    if (avgOvr >= SQUAD_WEAK_AVG_OVR) return "on_track";
    return "weak";
  }
  if (avgOvr >= SQUAD_TARGET_AVG_OVR - 2) return "strong";
  if (avgOvr >= SQUAD_WEAK_AVG_OVR) return "on_track";
  if (avgOvr >= SQUAD_WEAK_AVG_OVR - 4) return "at_risk";
  return "weak";
}

/**
 * How strong the next pick must be to keep the draft on a credible XI trajectory.
 * Hand calc: 3 picks at 80 avg, 8 left → need 72*11=792 total, 240 so far,
 * need 552/8=69 min average for remaining slots → targetMinPickOvr ≈ 69.
 */
export function targetMinPickOvr(
  rosterOvrs: number[],
  squadSize: number,
): number {
  const filled = rosterOvrs.length;
  const remaining = Math.max(1, squadSize - filled);
  const targetTotal = SQUAD_TARGET_AVG_OVR * squadSize;
  const currentTotal = rosterOvrs.reduce((a, b) => a + b, 0);
  const needed = (targetTotal - currentTotal) / remaining;
  const cushion = filled >= squadSize - 3 ? 2 : 4;
  return Math.max(SQUAD_MIN_STARTER_OVR, Math.round(needed - cushion));
}

export function evaluateSquadQuality(
  rosterIds: string[],
  poolMap: Map<string, RatedPlayerCard>,
  squadSize: number,
): SquadQualitySnapshot {
  const ovrs = rosterIds
    .map((id) => poolMap.get(id)?.ovr)
    .filter((n): n is number => n != null && n > 0);
  const filled = ovrs.length;
  const picksRemaining = Math.max(0, squadSize - filled);
  const avgOvr = filled ? avg(ovrs) : 0;
  const minOvr = filled ? Math.min(...ovrs) : 0;
  const maxOvr = filled ? Math.max(...ovrs) : 0;
  const minTargetOvr = filled >= squadSize ? 0 : targetMinPickOvr(ovrs, squadSize);
  const band = squadQualityBand(avgOvr, picksRemaining);
  return {
    avgOvr: Math.round(avgOvr * 10) / 10,
    minOvr,
    maxOvr,
    filled,
    squadSize,
    picksRemaining,
    targetMinPickOvr: minTargetOvr,
    band,
    needsQualityBoost: filled > 0 && (band === "at_risk" || band === "weak"),
  };
}

/** Weight multiplier for wheel segments / candidates when the squad is trending weak. */
export function qualityWeightBoost(cardOvr: number, targetMin: number): number {
  if (targetMin <= 0) return 1;
  if (cardOvr >= targetMin + 6) return 1.45;
  if (cardOvr >= targetMin) return 1.2;
  if (cardOvr >= targetMin - 4) return 0.75;
  return 0.35;
}
