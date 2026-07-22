import { describe, expect, it } from "vitest";
import type { RatedPlayerCard } from "@sportverse/draftballer-types";
import {
  buildSquadSynergy,
  setSimPartnershipPairs,
  synergyChanceBoost,
} from "./synergy-graph.js";

function card(
  partial: Partial<RatedPlayerCard> & Pick<RatedPlayerCard, "playerId" | "name" | "position">,
): RatedPlayerCard {
  return {
    nationality: "Brazil",
    ovr: 86,
    tier: "gold",
    fameScore: 80,
    fameTier: "star",
    attributes: { pac: 80, sho: 80, pas: 80, dri: 80, def: 70, phy: 80 },
    confidence: 0.9,
    breakdown: {
      base: 80,
      form: 0,
      chemistryBonus: 0,
      era: 0,
      role: 0,
      awardBonus: 0,
    },
    ...partial,
  };
}

describe("synergy-graph", () => {
  it("detects creator–finisher style links", () => {
    const squad = [
      card({
        playerId: "am1",
        name: "Creator",
        position: "AM",
        attributes: { pac: 78, sho: 72, pas: 90, dri: 88, def: 55, phy: 70 },
      }),
      card({
        playerId: "st1",
        name: "Finisher",
        position: "ST",
        attributes: { pac: 86, sho: 92, pas: 70, dri: 84, def: 40, phy: 78 },
      }),
      card({ playerId: "cb1", name: "Wall", position: "CB", nationality: "Italy" }),
    ];
    const syn = buildSquadSynergy(squad);
    expect(syn.score).toBeGreaterThan(0.1);
    expect(syn.links.some((l) => l.kind === "style")).toBe(true);
    expect(synergyChanceBoost(syn)).toBeGreaterThan(0);
    expect(synergyChanceBoost(syn)).toBeLessThanOrEqual(0.1);
  });

  it("honours curated partnership pairs", () => {
    setSimPartnershipPairs([
      {
        playerAId: "x",
        playerBId: "y",
        chemistryBonus: 3,
        label: "Historic duo",
      },
    ]);
    const syn = buildSquadSynergy([
      card({ playerId: "x", name: "Xavi", position: "CM", nationality: "Spain" }),
      card({ playerId: "y", name: "Iniesta", position: "AM", nationality: "Spain" }),
    ]);
    expect(syn.links.some((l) => l.kind === "partnership" && l.label === "Historic duo")).toBe(true);
    setSimPartnershipPairs([]);
  });
});
