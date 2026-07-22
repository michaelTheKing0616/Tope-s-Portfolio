import { describe, expect, it } from "vitest";
import type { RatedPlayerCard } from "@sportverse/draftballer-types";
import { createRng } from "./rng.js";
import { buildPersonaMap } from "./player-traits.js";
import { pickSetPieceKind, resolveSetPiece, shouldTriggerSetPiece } from "./set-piece.js";

function card(id: string, pos: RatedPlayerCard["position"], attrs?: Partial<RatedPlayerCard["attributes"]>): RatedPlayerCard {
  return {
    playerId: id,
    name: id,
    nationality: "Spain",
    position: pos,
    ovr: 85,
    tier: "gold",
    fameScore: 70,
    fameTier: "known",
    attributes: {
      pac: 80,
      sho: 82,
      pas: 86,
      dri: 80,
      def: 60,
      phy: 84,
      ...attrs,
    },
    confidence: 0.9,
    breakdown: {
      base: 80,
      form: 0,
      chemistryBonus: 0,
      era: 0,
      role: 0,
      awardBonus: 0,
    },
  };
}

describe("set-piece", () => {
  it("emits corner/free-kick narrative and respects score quota", () => {
    const rng = createRng("set-piece-v1");
    const attackers = [
      card("taker", "CM", { pas: 92, sho: 78 }),
      card("target", "ST", { phy: 90, sho: 88 }),
    ];
    const personas = buildPersonaMap(attackers);
    const blocked = resolveSetPiece({
      kind: "corner",
      minute: 44,
      team: "home",
      attackers,
      personas,
      canScore: false,
      dueSoon: false,
      rng,
      goalText: (s, m) => `${m}' GOAL! ${s.name}`,
    });
    expect(blocked.scored).toBe(false);
    expect(blocked.events.some((e) => e.type === "corner")).toBe(true);

    const open = resolveSetPiece({
      kind: pickSetPieceKind(rng),
      minute: 67,
      team: "away",
      attackers,
      personas,
      canScore: true,
      dueSoon: true,
      rng,
      goalText: (s, m) => `${m}' GOAL! ${s.name}`,
    });
    expect(open.events.length).toBeGreaterThan(1);
    expect(open.xg).toBeGreaterThan(0);
  });

  it("triggers more often when chasing with set-piece threat", () => {
    const rng = createRng("sp-trigger");
    let hits = 0;
    for (let i = 0; i < 200; i++) {
      if (
        shouldTriggerSetPiece({
          minute: 80,
          chase: 0.15,
          setPieceThreat: 0.9,
          dueSoon: false,
          rng,
        })
      ) {
        hits++;
      }
    }
    expect(hits).toBeGreaterThan(5);
  });
});
