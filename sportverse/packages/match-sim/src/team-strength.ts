/**
 * Squad → team attack α / defense β signals for Dixon–Coles Layer 1.
 * Real-World Grounded Engine v4 §3.1.
 */

import type { RatedPlayerCard } from "@sportverse/draftballer-types";
import { getFormation } from "./formations.js";
import { squadStrengths } from "./squad.js";
import type { BridgeCoefficients } from "./aggregation-bridge.js";

export interface SquadStrengthSignals {
  attackSignal: number;
  defenseWeakness: number;
  alpha: number;
  beta: number;
}

const ATTACK_ROLES = new Set(["ST", "W", "AM", "CM"]);
const DEFENSE_ROLES = new Set(["CB", "FB", "DM", "GK"]);

function weightedAttack(player: RatedPlayerCard): number {
  const { sho, pas, dri, pac } = player.attributes;
  return sho * 0.4 + pas * 0.3 + dri * 0.2 + pac * 0.1;
}

function weightedDefenseWeakness(player: RatedPlayerCard): number {
  const { def, phy } = player.attributes;
  if (player.position === "GK") {
    return 100 - (def * 0.55 + phy * 0.45);
  }
  return 100 - (def * 0.5 + phy * 0.35 + player.attributes.pac * 0.15);
}

function formationRoleWeights(formationId: string): { attack: number; defense: number } {
  const form = getFormation(formationId);
  if (!form) return { attack: 1, defense: 1 };
  let attackSlots = 0;
  let defenseSlots = 0;
  for (const slot of form.slots) {
    if (["ST", "W", "AM"].includes(slot.positionTag)) attackSlots++;
    if (["CB", "FB", "DM", "GK"].includes(slot.positionTag)) defenseSlots++;
  }
  return {
    attack: Math.max(1, attackSlots) / form.slots.length,
    defense: Math.max(1, defenseSlots) / form.slots.length,
  };
}

export function squadStrengthSignals(
  players: RatedPlayerCard[],
  formationId: string,
  bridge: BridgeCoefficients,
): SquadStrengthSignals {
  const weights = formationRoleWeights(formationId);
  const strengths = squadStrengths(players);

  let attackSum = 0;
  let attackW = 0;
  let defWeakSum = 0;
  let defW = 0;

  for (const p of players) {
    if (p.position === "GK") {
      defWeakSum += weightedDefenseWeakness(p) * 1.2;
      defW += 1.2;
      continue;
    }
    if (ATTACK_ROLES.has(p.position)) {
      attackSum += weightedAttack(p);
      attackW += 1;
    }
    if (DEFENSE_ROLES.has(p.position)) {
      defWeakSum += weightedDefenseWeakness(p);
      defW += 1;
    }
  }

  const attackSignal =
    attackW > 0 ? attackSum / attackW : (strengths.attack + strengths.midfield) / 2;
  const defenseWeakness =
    defW > 0 ? defWeakSum / defW : 100 - strengths.defense;

  const alpha =
    bridge.alphaIntercept +
    bridge.alphaSlope * ((attackSignal - 65) / 20) * weights.attack;
  const beta =
    bridge.betaIntercept +
    bridge.betaSlope * ((defenseWeakness - 35) / 20) * weights.defense;

  return { attackSignal, defenseWeakness, alpha, beta };
}
