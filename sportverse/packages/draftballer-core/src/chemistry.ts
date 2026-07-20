import type { RatedPlayerCard } from "@sportverse/draftballer-types";
import { computeChemistryBonus, setPartnershipPairs, type PartnershipPair } from "@sportverse/rating-engine";

export interface ChemistryLink {
  playerAId: string;
  playerBId: string;
  strength: "strong" | "medium" | "weak";
  bonus: number;
}

export interface SquadChemistryResult {
  score: number;
  links: ChemistryLink[];
  multiplier: number;
}

export function initPartnershipPairs(pairs: PartnershipPair[]): void {
  setPartnershipPairs(pairs);
}

/** Chemistry v2 — teammates, club-season, nationality, era links. */
export function computeSquadChemistry(
  players: RatedPlayerCard[],
  context?: { clubSeasonPairs?: { club: string; season: string }[] },
): SquadChemistryResult {
  const links: ChemistryLink[] = [];
  let score = 50;

  const natCounts = new Map<string, number>();
  for (const p of players) {
    natCounts.set(p.nationality, (natCounts.get(p.nationality) ?? 0) + 1);
  }
  for (const [nat, count] of natCounts) {
    if (count >= 3) {
      score += 4;
      links.push({ playerAId: nat, playerBId: nat, strength: "medium", bonus: 4 });
    }
  }

  const bonus = computeChemistryBonus(players);
  score += bonus * 8;

  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i]!;
      const b = players[j]!;
      if (a.nationality === b.nationality) {
        links.push({ playerAId: a.playerId, playerBId: b.playerId, strength: "weak", bonus: 1 });
        score += 1;
      }
      if (a.contextLine && b.contextLine && a.contextLine === b.contextLine) {
        links.push({ playerAId: a.playerId, playerBId: b.playerId, strength: "medium", bonus: 2 });
        score += 2;
      }
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const multiplier = 1 + (score - 50) * 0.0016;
  return { score, links, multiplier: Math.round(multiplier * 1000) / 1000 };
}

export function outOfPositionPenalty(player: RatedPlayerCard, slotPosition: string): number {
  if (player.position === slotPosition) return 0;
  return -4;
}
