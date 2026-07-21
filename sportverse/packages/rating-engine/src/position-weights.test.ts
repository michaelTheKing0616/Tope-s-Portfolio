import { describe, expect, it } from "vitest";
import type { PlayerAttributes, Position } from "@sportverse/draftballer-types";
import {
  mapQuizPosition,
  ovrFromAttributes,
  resolveRatingPosition,
  POSITION_WEIGHTS,
} from "./position-weights.js";

const SAMPLE_ATTRS: PlayerAttributes = {
  pac: 80,
  sho: 80,
  pas: 80,
  dri: 80,
  def: 80,
  phy: 80,
};

describe("mapQuizPosition — every DB / EA label", () => {
  const cases: Array<[string, Position]> = [
    ["Goalkeeper", "GK"],
    ["Centre-Back", "CB"],
    ["Center-Back", "CB"],
    ["Left-Back", "FB"],
    ["Right-Back", "FB"],
    ["Wing-Back", "FB"],
    ["Defensive Midfielder", "DM"],
    ["Defensive Midfield", "DM"],
    ["Central Midfielder", "CM"],
    ["Midfielder", "CM"],
    ["Attacking Midfielder", "AM"],
    ["Attacking Midfield", "AM"],
    ["Winger", "W"],
    ["Left Winger", "W"],
    ["Right Midfielder", "W"],
    ["Striker", "ST"],
    ["Forward", "ST"],
    ["Second Striker", "ST"],
    ["Defender", "CB"],
    ["GK", "GK"],
    ["CB", "CB"],
    ["LB", "FB"],
    ["RB", "FB"],
    ["LWB", "FB"],
    ["CDM", "DM"],
    ["CM", "CM"],
    ["CAM", "AM"],
    ["LW", "W"],
    ["RW", "W"],
    ["ST", "ST"],
    ["CF", "ST"],
  ];

  it.each(cases)("%s → %s", (raw, expected) => {
    expect(mapQuizPosition(raw)).toBe(expected);
  });

  it("never maps attacking midfielders to ST via the attack keyword", () => {
    expect(mapQuizPosition("Attacking Midfielder")).toBe("AM");
    expect(mapQuizPosition("attacking midfield")).toBe("AM");
  });
});

describe("resolveRatingPosition", () => {
  it("uses EA role when archive label is coarse", () => {
    expect(resolveRatingPosition("Defender", "FB")).toBe("FB");
    expect(resolveRatingPosition("Midfielder", "DM")).toBe("DM");
    expect(resolveRatingPosition("Forward", "W")).toBe("W");
  });

  it("keeps precise archive roles over EA", () => {
    expect(resolveRatingPosition("Left-Back", "CB")).toBe("FB");
    expect(resolveRatingPosition("Centre-Back", "FB")).toBe("CB");
  });

  it("always scores keepers as GK", () => {
    expect(resolveRatingPosition("Goalkeeper", "ST")).toBe("GK");
    expect(resolveRatingPosition("Striker", "GK")).toBe("GK");
  });
});

describe("position-specific OVR weights", () => {
  it("every quiz position has weights summing to ~1", () => {
    for (const pos of Object.keys(POSITION_WEIGHTS) as Position[]) {
      const sum = Object.values(POSITION_WEIGHTS[pos]).reduce((a, b) => a + b, 0);
      expect(sum).toBeGreaterThan(0.98);
      expect(sum).toBeLessThan(1.02);
    }
  });

  it("same attributes score differently by position (role-correct weights)", () => {
    const byPos = (Object.keys(POSITION_WEIGHTS) as Position[]).map((pos) => ({
      pos,
      ovr: ovrFromAttributes(pos, SAMPLE_ATTRS),
    }));
    // Uniform 80 attrs → every role yields 80 with normalized weights
    for (const row of byPos) expect(row.ovr).toBe(80);

    const shooter: PlayerAttributes = { pac: 70, sho: 95, pas: 60, dri: 75, def: 30, phy: 70 };
    const st = ovrFromAttributes("ST", shooter);
    const cb = ovrFromAttributes("CB", shooter);
    const fb = ovrFromAttributes("FB", shooter);
    expect(st).toBeGreaterThan(cb);
    expect(st).toBeGreaterThan(fb);

    const stopper: PlayerAttributes = { pac: 60, sho: 30, pas: 55, dri: 50, def: 92, phy: 88 };
    expect(ovrFromAttributes("CB", stopper)).toBeGreaterThan(ovrFromAttributes("ST", stopper));
    expect(ovrFromAttributes("FB", stopper)).toBeGreaterThan(ovrFromAttributes("ST", stopper));
    expect(ovrFromAttributes("DM", stopper)).toBeGreaterThan(ovrFromAttributes("ST", stopper));
  });
});
