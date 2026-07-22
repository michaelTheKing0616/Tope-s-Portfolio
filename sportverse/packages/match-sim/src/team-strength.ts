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

/**
 * Formation tilt — a 3-striker shape leans attack, a 5-back shape leans defense.
 * Normalized around 1.0 (typical shapes: ~3 attackers, ~5 defenders) so the tilt
 * shifts balance slightly instead of crushing the whole strength signal.
 */
function formationRoleWeights(formationId: string): { attack: number; defense: number } {
  const form = getFormation(formationId);
  if (!form) return { attack: 1, defense: 1 };
  let attackSlots = 0;
  let defenseSlots = 0;
  for (const slot of form.slots) {
    if (["ST", "W", "AM"].includes(slot.positionTag)) attackSlots++;
    if (["CB", "FB", "DM", "GK"].includes(slot.positionTag)) defenseSlots++;
  }
  const clamp = (n: number) => Math.max(0.85, Math.min(1.15, n));
  return {
    attack: clamp(attackSlots / 3.2),
    defense: clamp(defenseSlots / 5.2),
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

  const squadOvr = players.reduce((s, p) => s + p.ovr, 0) / Math.max(1, players.length);
  const rawAttack =
    attackW > 0 ? attackSum / attackW : (strengths.attack + strengths.midfield) / 2;
  // Headline OVR anchors attack when face stats understate finishers (common for stats-only CB-heavy XIs).
  const attackSignal = rawAttack * 0.55 + squadOvr * 0.45;
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
