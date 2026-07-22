/**
 * Derived match personalities — Layer 2 only.
 * Influences scorer preference, chance flavor, and set-piece rates — not λ/μ.
 */

import type { RatedPlayerCard } from "@sportverse/draftballer-types";

export type SimTrait =
  | "clinical"
  | "aerial"
  | "set_piece"
  | "long_shot"
  | "presser"
  | "creator"
  | "speedster"
  | "ball_winner"
  | "target_man"
  | "shot_stopper";

export interface PlayerMatchPersona {
  playerId: string;
  name: string;
  traits: SimTrait[];
  /** Primary tag for commentary. */
  signature: string;
}

export function derivePlayerTraits(player: RatedPlayerCard): PlayerMatchPersona {
  const a = player.attributes;
  const traits: SimTrait[] = [];

  if (player.position === "GK") {
    traits.push("shot_stopper");
    return {
      playerId: player.playerId,
      name: player.name,
      traits,
      signature: a.pas >= a.def ? "Distribution" : "Shot-stopping",
    };
  }

  if (a.sho >= 86) traits.push("clinical");
  if (a.phy >= 84 && (player.position === "ST" || player.position === "CB" || a.sho >= 78)) {
    traits.push("aerial");
  }
  if (a.pas >= 86) traits.push("set_piece");
  if (a.sho >= 84 && a.pas < 80) traits.push("long_shot");
  if (a.pac >= 86 && a.phy >= 78) traits.push("presser");
  if (a.pas >= 84 && ["AM", "CM", "W"].includes(player.position)) traits.push("creator");
  if (a.pac >= 88) traits.push("speedster");
  if (a.def >= 84 && ["DM", "CM", "CB", "FB"].includes(player.position)) traits.push("ball_winner");
  if (player.position === "ST" && a.phy >= 86) traits.push("target_man");

  if (!traits.length) {
    if (a.sho >= a.pas) traits.push("clinical");
    else traits.push("creator");
  }

  const signature =
    traits[0] === "set_piece"
      ? "Set-Piece Threat"
      : traits[0] === "aerial" || traits[0] === "target_man"
        ? "Aerial Threat"
        : traits[0] === "speedster"
          ? "Explosive Pace"
          : traits[0] === "creator"
            ? "Through Ball"
            : traits[0] === "long_shot"
              ? "Long Shot"
              : traits[0] === "presser"
                ? "Press Trigger"
                : traits[0] === "ball_winner"
                  ? "Aggressive Tackle"
                  : "Box Presence";

  return { playerId: player.playerId, name: player.name, traits, signature };
}

export function buildPersonaMap(players: RatedPlayerCard[]): Map<string, PlayerMatchPersona> {
  const map = new Map<string, PlayerMatchPersona>();
  for (const p of players) map.set(p.playerId, derivePlayerTraits(p));
  return map;
}

export function traitScorerWeight(persona: PlayerMatchPersona | undefined, base: number): number {
  if (!persona) return base;
  let w = base;
  if (persona.traits.includes("clinical")) w *= 1.25;
  if (persona.traits.includes("aerial")) w *= 1.1;
  if (persona.traits.includes("speedster")) w *= 1.08;
  if (persona.traits.includes("target_man")) w *= 1.12;
  return w;
}

export function traitXgBias(persona: PlayerMatchPersona | undefined, kind: "open" | "set_piece"): number {
  if (!persona) return 0;
  if (kind === "set_piece") {
    if (persona.traits.includes("set_piece")) return 0.06;
    if (persona.traits.includes("aerial") || persona.traits.includes("target_man")) return 0.05;
    return 0.01;
  }
  if (persona.traits.includes("clinical")) return 0.03;
  if (persona.traits.includes("long_shot")) return 0.015;
  return 0;
}

export function squadSetPieceThreat(personas: Map<string, PlayerMatchPersona>): number {
  let n = 0;
  for (const p of personas.values()) {
    if (p.traits.includes("set_piece")) n += 1.2;
    else if (p.traits.includes("aerial") || p.traits.includes("creator")) n += 0.4;
  }
  return Math.min(1, n / 4);
}
