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

/** Era-scaled goals environment — lower tempo eras produce fewer expected goals. */
export function eraGoalsPerGameScale(era?: EraProfile): number {
  if (!era) return 1;
  return 0.72 + era.tempo * 0.55 + (1 - era.tactical_sophistication) * 0.08;
}

export function computeMatchGoalRates(input: MatchGoalRateInput): DixonColesRates {
  const bridge = getBridgeCoefficients();
  const homeSig = squadStrengthSignals(input.homePlayers, input.formationHomeId, bridge);
  const awaySig = squadStrengthSignals(input.awayPlayers, input.formationAwayId, bridge);

  const alphaHome = homeSig.alpha + (input.tacticalAttackBoostHome ?? 0);
  const alphaAway = awaySig.alpha + (input.tacticalAttackBoostAway ?? 0);

  return computeDixonColesRates(
    alphaHome,
    awaySig.beta,
    alphaAway,
    homeSig.beta,
    {
      homeAdvantage: input.homeAdvantage !== false,
      gpgScale: eraGoalsPerGameScale(input.era),
    },
  );
}
