import type { RatedPlayerCard } from "@sportverse/draftballer-types";

export interface PartnershipPair {
  playerAId: string;
  playerBId: string;
  chemistryBonus: number;
  label?: string;
}

let partnershipPairs: PartnershipPair[] = [];

export function setPartnershipPairs(rows: PartnershipPair[]): void {
  partnershipPairs = rows;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Squad chemistry bonus — nationality clusters + curated partnership pairs (§4.8). */
export function computeChemistryBonus(players: RatedPlayerCard[]): number {
  if (players.length < 2) return 0;

  const natCounts = new Map<string, number>();
  for (const p of players) {
    natCounts.set(p.nationality, (natCounts.get(p.nationality) ?? 0) + 1);
  }

  let bonus = 0;
  for (const count of natCounts.values()) {
    if (count >= 3) bonus += 0.5;
    if (count >= 5) bonus += 0.5;
    if (count >= 7) bonus += 0.5;
  }

  const positions = new Set(players.map((p) => p.position));
  if (positions.size >= 6) bonus += 0.5;

  const ids = new Set(players.map((p) => p.playerId));
  for (const pair of partnershipPairs) {
    if (ids.has(pair.playerAId) && ids.has(pair.playerBId)) bonus += pair.chemistryBonus;
  }

  return Math.min(5, Math.round(bonus * 10) / 10);
}
