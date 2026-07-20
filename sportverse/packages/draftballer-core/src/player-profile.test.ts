import { describe, expect, it } from "vitest";
import type { RatedPlayerCard } from "@sportverse/draftballer-types";
import { derivePlayerCardProfile } from "./player-profile.js";

function stub(partial: Partial<RatedPlayerCard> & Pick<RatedPlayerCard, "playerId" | "position" | "attributes">): RatedPlayerCard {
  return {
    name: partial.name ?? "Test",
    nationality: "—",
    ovr: partial.ovr ?? 85,
    tier: "gold",
    fameScore: 50,
    fameTier: "known",
    confidence: 0.9,
    breakdown: {
      clubOvrRaw: 85,
      intlOvrRaw: 80,
      awardBonus: 0,
      lens: "club_only",
      blendFactor: 0,
    },
    ...partial,
  };
}

describe("player card profile — hybrid DNA", () => {
  it("clinical finisher: high SHO ST", () => {
    const p = derivePlayerCardProfile(
      stub({
        playerId: "finisher-1",
        position: "ST",
        attributes: { pac: 88, sho: 94, pas: 70, dri: 84, def: 40, phy: 78 },
      }),
    );
    expect(p.archetype).toBe("Clinical Finisher");
    expect(["Curved Runs", "Box Presence", "Long Shot"]).toContain(p.signature);
  });

  it("defensive wall: high DEF CB", () => {
    const p = derivePlayerCardProfile(
      stub({
        playerId: "wall-1",
        position: "CB",
        attributes: { pac: 68, sho: 40, pas: 72, dri: 55, def: 92, phy: 90 },
      }),
    );
    expect(p.archetype).toBe("Defensive Wall");
    expect(p.signature).toBe("Aggressive Tackle");
  });

  it("weak foot / skill stars are 1–5 and deterministic", () => {
    const card = stub({
      playerId: "stable-meta",
      position: "CM",
      attributes: { pac: 80, sho: 78, pas: 88, dri: 86, def: 74, phy: 80 },
    });
    const a = derivePlayerCardProfile(card);
    const b = derivePlayerCardProfile(card);
    expect(a.weakFoot).toBe(b.weakFoot);
    expect(a.skillMoves).toBe(b.skillMoves);
    expect(a.weakFoot).toBeGreaterThanOrEqual(1);
    expect(a.weakFoot).toBeLessThanOrEqual(5);
    expect(a.formationFits[0]!.stars).toBeGreaterThanOrEqual(1);
  });
});
