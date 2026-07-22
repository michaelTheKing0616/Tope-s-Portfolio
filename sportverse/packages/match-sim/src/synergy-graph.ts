/**
 * Layer 2 synergy graph — neighbour links modify possession / chance quality,
 * never Dixon–Coles λ/μ or OVR.
 */

import type { RatedPlayerCard } from "@sportverse/draftballer-types";

export interface SimPartnershipPair {
  playerAId: string;
  playerBId: string;
  chemistryBonus: number;
  label?: string;
}

export interface SynergyLink {
  playerAId: string;
  playerBId: string;
  playerAName: string;
  playerBName: string;
  kind: "partnership" | "nationality" | "style" | "context";
  strength: number;
  label: string;
}

export interface SquadSynergy {
  /** 0–1 narrative boost (possession / chance fluidity). */
  score: number;
  links: SynergyLink[];
  headline?: string;
}

let partnershipIndex: Map<string, SimPartnershipPair> = new Map();

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function setSimPartnershipPairs(rows: SimPartnershipPair[]): void {
  partnershipIndex = new Map();
  for (const row of rows) {
    partnershipIndex.set(pairKey(row.playerAId, row.playerBId), row);
  }
}

export function getSimPartnershipPairCount(): number {
  return partnershipIndex.size;
}

/** Complementary style pairs — target man + crosser, creator + finisher, etc. */
function styleSynergy(a: RatedPlayerCard, b: RatedPlayerCard): { strength: number; label: string } | null {
  const ap = a.position;
  const bp = b.position;
  const aa = a.attributes;
  const ba = b.attributes;

  // Creator + finisher
  if (
    (["AM", "CM", "W"].includes(ap) && aa.pas >= 82 && bp === "ST" && ba.sho >= 82) ||
    (["AM", "CM", "W"].includes(bp) && ba.pas >= 82 && ap === "ST" && aa.sho >= 82)
  ) {
    return { strength: 0.9, label: "Creator–finisher axis" };
  }
  // Target man + elite crosser
  if (
    (ap === "ST" && aa.phy >= 84 && ["W", "FB"].includes(bp) && ba.pas >= 80) ||
    (bp === "ST" && ba.phy >= 84 && ["W", "FB"].includes(ap) && aa.pas >= 80)
  ) {
    return { strength: 0.85, label: "Aerial target + supplier" };
  }
  // Ball-winner + deep playmaker
  if (
    (["DM", "CM", "CB"].includes(ap) && aa.def >= 84 && ["CM", "AM", "DM"].includes(bp) && ba.pas >= 84) ||
    (["DM", "CM", "CB"].includes(bp) && ba.def >= 84 && ["CM", "AM", "DM"].includes(ap) && aa.pas >= 84)
  ) {
    return { strength: 0.8, label: "Destroyer–orchestrator" };
  }
  // Twin CBs
  if (ap === "CB" && bp === "CB" && aa.def >= 80 && ba.def >= 80) {
    return { strength: 0.7, label: "Centre-back partnership" };
  }
  // Wing duo same flank vibes
  if (ap === "W" && bp === "W" && aa.pac >= 84 && ba.pac >= 84) {
    return { strength: 0.55, label: "Wide pace threat" };
  }
  return null;
}

export function buildSquadSynergy(players: RatedPlayerCard[]): SquadSynergy {
  if (players.length < 2) return { score: 0, links: [] };

  const links: SynergyLink[] = [];
  const byId = new Map(players.map((p) => [p.playerId, p]));

  // Curated co-minutes / historic pairs
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i]!;
      const b = players[j]!;
      const curated = partnershipIndex.get(pairKey(a.playerId, b.playerId));
      if (curated) {
        const strength = Math.min(1.2, 0.45 + curated.chemistryBonus * 0.18);
        links.push({
          playerAId: a.playerId,
          playerBId: b.playerId,
          playerAName: a.name,
          playerBName: b.name,
          kind: "partnership",
          strength,
          label: curated.label ?? "Historic partnership",
        });
      }

      if (a.nationality && a.nationality === b.nationality) {
        links.push({
          playerAId: a.playerId,
          playerBId: b.playerId,
          playerAName: a.name,
          playerBName: b.name,
          kind: "nationality",
          strength: 0.35,
          label: `National understanding (${a.nationality})`,
        });
      }

      if (a.contextLine && b.contextLine && a.contextLine === b.contextLine) {
        links.push({
          playerAId: a.playerId,
          playerBId: b.playerId,
          playerAName: a.name,
          playerBName: b.name,
          kind: "context",
          strength: 0.5,
          label: "Shared club context",
        });
      }

      const style = styleSynergy(a, b);
      if (style) {
        links.push({
          playerAId: a.playerId,
          playerBId: b.playerId,
          playerAName: a.name,
          playerBName: b.name,
          kind: "style",
          strength: style.strength,
          label: style.label,
        });
      }
    }
  }

  // Deduplicate same pair keeping strongest
  const best = new Map<string, SynergyLink>();
  for (const link of links) {
    const k = pairKey(link.playerAId, link.playerBId);
    const prev = best.get(k);
    if (!prev || link.strength > prev.strength) best.set(k, link);
  }
  const unique = [...best.values()].sort((a, b) => b.strength - a.strength);
  const raw = unique.reduce((s, l) => s + l.strength, 0);
  const score = Math.min(1, raw / 6.5);

  const top = unique[0];
  const headline = top
    ? unique.filter((l) => l.kind === "partnership" || l.strength >= 0.8).length >= 2
      ? `${unique.filter((l) => l.strength >= 0.7).length} strong on-pitch links humming`
      : `${top.playerAName.split(" ").pop()} ↔ ${top.playerBName.split(" ").pop()} — ${top.label}`
    : undefined;

  // Sanity: ensure names resolve if ids odd
  for (const link of unique) {
    if (!byId.has(link.playerAId) || !byId.has(link.playerBId)) continue;
  }

  return { score, links: unique.slice(0, 12), headline };
}

/** Soft modifier for possession / chance prob — capped so L1 score script stays king. */
export function synergyChanceBoost(synergy: SquadSynergy): number {
  return Math.min(0.1, synergy.score * 0.12);
}

/** Prefer scorers who share a strong link with a creator in the XI. */
export function pickLinkedScorer(
  attackers: RatedPlayerCard[],
  squad: RatedPlayerCard[],
  synergy: SquadSynergy,
  rng: () => number,
): RatedPlayerCard | null {
  if (!attackers.length) return null;
  const linkedIds = new Set<string>();
  for (const link of synergy.links) {
    if (link.strength < 0.65) continue;
    linkedIds.add(link.playerAId);
    linkedIds.add(link.playerBId);
  }
  const preferred = attackers.filter((p) => linkedIds.has(p.playerId));
  const pool = preferred.length && rng() < 0.55 ? preferred : attackers;
  const weights = pool.map((p) => p.attributes.sho + p.ovr * 0.3);
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) return pool[i]!;
  }
  return pool[0] ?? squad[0] ?? null;
}
