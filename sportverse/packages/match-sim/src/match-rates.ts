/**
 * Layer 1 match goal-rate computation — Match Intelligence Engine v5.
 * Feature-rich rates replace plain Dixon–Coles α+β; Poisson sampling retained.
 */

import type { RatedPlayerCard, TacticalIdentity, EraProfile } from "@sportverse/draftballer-types";
import type { DixonColesRates } from "./dixon-coles.js";
import {
  computeIntelligentMatchRates,
  eraGoalsPerGameScale,
  squadGoalRateFloor,
} from "./match-intelligence.js";

export { eraGoalsPerGameScale, squadGoalRateFloor };

export interface MatchGoalRateInput {
  homePlayers: RatedPlayerCard[];
  awayPlayers: RatedPlayerCard[];
  formationHomeId: string;
  formationAwayId: string;
  homeAdvantage?: boolean;
  era?: EraProfile;
  tacticalIdentityHome?: TacticalIdentity;
  tacticalIdentityAway?: TacticalIdentity;
  /** Tactical identity modifier on attack α (Sim Engine v2 §3). */
  tacticalAttackBoostHome?: number;
  tacticalAttackBoostAway?: number;
  homeEraFriction?: number;
  awayEraFriction?: number;
}

export function computeMatchGoalRates(input: MatchGoalRateInput): DixonColesRates {
  return computeIntelligentMatchRates({
    homePlayers: input.homePlayers,
    awayPlayers: input.awayPlayers,
    formationHomeId: input.formationHomeId,
    formationAwayId: input.formationAwayId,
    homeAdvantage: input.homeAdvantage,
    era: input.era,
    tacticalIdentityHome: input.tacticalIdentityHome,
    tacticalIdentityAway: input.tacticalIdentityAway,
    tacticalAttackBoostHome: input.tacticalAttackBoostHome,
    tacticalAttackBoostAway: input.tacticalAttackBoostAway,
    homeEraFriction: input.homeEraFriction,
    awayEraFriction: input.awayEraFriction,
  });
}
