import { describe, expect, it } from "vitest";
import type { RatedPlayerCard } from "@sportverse/draftballer-types";
import { derivePlayerTraits, squadSetPieceThreat, buildPersonaMap } from "./player-traits.js";

function card(partial: Partial<RatedPlayerCard> & Pick<RatedPlayerCard, "playerId" | "position">): RatedPlayerCard {
  return {
    name: "Test",
    nationality: "England",
    ovr: 84,
    tier: "gold",
    fameScore: 70,
    fameTier: "known",
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

describe("player-traits", () => {
  it("tags clinical finishers and set-piece threats", () => {
    const clinical = derivePlayerTraits(
      card({
        playerId: "1",
        position: "ST",
        attributes: { pac: 84, sho: 92, pas: 70, dri: 86, def: 40, phy: 78 },
      }),
    );
    expect(clinical.traits).toContain("clinical");

    const setPiece = derivePlayerTraits(
      card({
        playerId: "2",
        position: "CM",
        attributes: { pac: 72, sho: 78, pas: 90, dri: 84, def: 70, phy: 74 },
      }),
    );
    expect(setPiece.traits).toContain("set_piece");
    expect(setPiece.signature).toBe("Set-Piece Threat");
  });

  it("aggregates squad set-piece threat", () => {
    const map = buildPersonaMap([
      card({
        playerId: "a",
        position: "CM",
        attributes: { pac: 70, sho: 75, pas: 90, dri: 80, def: 70, phy: 72 },
      }),
      card({
        playerId: "b",
        position: "ST",
        attributes: { pac: 80, sho: 85, pas: 70, dri: 80, def: 40, phy: 88 },
      }),
    ]);
    expect(squadSetPieceThreat(map)).toBeGreaterThan(0.2);
  });
});
