import type { RatedPlayerCard } from "@sportverse/draftballer-types";

export interface SquadStrengths {
  attack: number;
  midfield: number;
  defense: number;
  gk: number;
  overall: number;
}

const ATTACK_POS = new Set(["ST", "W", "AM"]);
const MID_POS = new Set(["CM", "DM", "AM"]);
const DEF_POS = new Set(["CB", "FB", "DM"]);

function avg(nums: number[]): number {
  if (!nums.length) return 50;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** Derive zone strengths from XI ratings and attributes (bible §7.1 zone matchups). */
export function squadStrengths(players: RatedPlayerCard[]): SquadStrengths {
  const attackAttrs: number[] = [];
  const midAttrs: number[] = [];
  const defAttrs: number[] = [];
  let gkScore = 55;

  for (const p of players) {
    const { pac, sho, pas, dri, def, phy } = p.attributes;
    if (p.position === "GK") {
      gkScore = (def * 0.35 + phy * 0.25 + pac * 0.15 + pas * 0.1 + sho * 0.05 + dri * 0.1);
      continue;
    }
    if (ATTACK_POS.has(p.position)) {
      attackAttrs.push(sho * 0.35 + dri * 0.3 + pac * 0.2 + pas * 0.15);
    }
    if (MID_POS.has(p.position)) {
      midAttrs.push(pas * 0.35 + dri * 0.25 + def * 0.2 + phy * 0.2);
    }
    if (DEF_POS.has(p.position)) {
      defAttrs.push(def * 0.45 + phy * 0.3 + pac * 0.15 + pas * 0.1);
    }
  }

  const attack = avg(attackAttrs.length ? attackAttrs : players.map((p) => p.ovr));
  const midfield = avg(midAttrs.length ? midAttrs : players.map((p) => p.attributes.pas));
  const defense = avg(defAttrs.length ? defAttrs : players.map((p) => p.attributes.def));
  const overall = avg(players.map((p) => p.ovr));

  return { attack, midfield, defense, gk: gkScore, overall };
}
