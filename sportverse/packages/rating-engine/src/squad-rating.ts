import type { RatedPlayerCard } from "@sportverse/draftballer-types";
import { zonePresence } from "@sportverse/match-sim";
import { computeChemistryBonus } from "./chemistry.js";

export interface SquadRatingBreakdown {
  squadRating: number;
  flatAverage: number;
  correctionFactor: number;
  chemistryBonus: number;
  zoneCoherenceBonus: number;
}

/** EA-style Correction Factor + chemistry + formation zone coherence (§4.2). */
export function computeSquadRating(
  players: RatedPlayerCard[],
  options: { formationId?: string } = {},
): SquadRatingBreakdown {
  if (!players.length) {
    return { squadRating: 0, flatAverage: 0, correctionFactor: 0, chemistryBonus: 0, zoneCoherenceBonus: 0 };
  }

  const ovrs = players.map((p) => p.ovr);
  const sum = ovrs.reduce((a, b) => a + b, 0);
  const flatAverage = sum / ovrs.length;
  const correctionFactor = ovrs.filter((o) => o > flatAverage).reduce((s, o) => s + (o - flatAverage), 0);
  const chemistryBonus = computeChemistryBonus(players);
  const zoneCoherenceBonus = options.formationId ? zoneCoherenceBonusForFormation(options.formationId) : 0;

  const squadRating = Math.round((sum + correctionFactor + chemistryBonus + zoneCoherenceBonus) / players.length);

  return {
    squadRating: Math.max(1, Math.min(99, squadRating)),
    flatAverage: Math.round(flatAverage * 10) / 10,
    correctionFactor: Math.round(correctionFactor * 10) / 10,
    chemistryBonus,
    zoneCoherenceBonus,
  };
}

function zoneCoherenceBonusForFormation(formationId: string): number {
  const presence = zonePresence(formationId);
  const zones = Object.values(presence);
  const covered = zones.filter((n) => n >= 1).length;
  const wideCover = (presence.att_left >= 1 ? 1 : 0) + (presence.att_right >= 1 ? 1 : 0);
  return Math.min(2, Math.round((covered / 9) * 1.5 + wideCover * 0.25));
}

/** Backward-compatible helper. */
export function squadRatingFromRoster(roster: string[], pool: Map<string, RatedPlayerCard>, formationId?: string): number {
  const players = roster.map((id) => pool.get(id)).filter(Boolean) as RatedPlayerCard[];
  return computeSquadRating(players, { formationId }).squadRating;
}
