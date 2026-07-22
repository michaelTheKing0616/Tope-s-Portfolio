/**
 * Layer 1 match goal-rate computation — bridge + Dixon–Coles (Engine v4 §2–3).
 */

import type { RatedPlayerCard } from "@sportverse/draftballer-types";
import type { EraProfile } from "@sportverse/draftballer-types";
import { getBridgeCoefficients } from "./aggregation-bridge.js";
import { computeDixonColesRates, type DixonColesRates } from "./dixon-coles.js";
import { squadStrengthSignals } from "./team-strength.js";

export interface MatchGoalRateInput {
  homePlayers: RatedPlayerCard[];
  awayPlayers: RatedPlayerCard[];
  formationHomeId: string;
  formationAwayId: string;
  homeAdvantage?: boolean;
  era?: EraProfile;
  /** Tactical identity modifier on attack α (Sim Engine v2 §3). */
  tacticalAttackBoostHome?: number;
  tacticalAttackBoostAway?: number;
}

/**
 * Era-scaled goals environment, anchored to real historical league averages.
 * gpgScale multiplies λ and μ so the era's TOTAL goals/game matches history:
 * 1950s ≈ 3.45, catenaccio Serie A ≈ 2.05, modern ≈ 2.85. Baseline 2.75.
 */
const BASELINE_GOALS_PER_GAME = 2.75;

export function eraGoalsPerGameScale(era?: EraProfile): number {
  if (!era) return 1;
  const anchor =
    era.goals_per_game ?? 0.72 * BASELINE_GOALS_PER_GAME + era.tempo * 1.4;
  return anchor / BASELINE_GOALS_PER_GAME;
}

function squadAvgOvr(players: RatedPlayerCard[]): number {
  if (!players.length) return 65;
  return players.reduce((s, p) => s + p.ovr, 0) / players.length;
}

/** Per-team expected goals floor from squad quality — stops OVR-80 sides grinding to 0-0 every week. */
export function squadGoalRateFloor(avgOvr: number): number {
  return 0.42 + Math.max(0, avgOvr - 50) * 0.017;
}

export function computeMatchGoalRates(input: MatchGoalRateInput): DixonColesRates {
  const bridge = getBridgeCoefficients();
  const homeSig = squadStrengthSignals(input.homePlayers, input.formationHomeId, bridge);
  const awaySig = squadStrengthSignals(input.awayPlayers, input.formationAwayId, bridge);

  const alphaHome = homeSig.alpha + (input.tacticalAttackBoostHome ?? 0);
  const alphaAway = awaySig.alpha + (input.tacticalAttackBoostAway ?? 0);

  const rates = computeDixonColesRates(
    alphaHome,
    awaySig.beta,
    alphaAway,
    homeSig.beta,
    {
      homeAdvantage: input.homeAdvantage !== false,
      gpgScale: eraGoalsPerGameScale(input.era),
    },
  );

  const homeFloor = squadGoalRateFloor(squadAvgOvr(input.homePlayers));
  const awayFloor = squadGoalRateFloor(squadAvgOvr(input.awayPlayers));
  return {
    ...rates,
    lambda: Math.max(rates.lambda, homeFloor),
    mu: Math.max(rates.mu, awayFloor),
  };
}
