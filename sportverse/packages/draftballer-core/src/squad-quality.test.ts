import { describe, expect, it } from "vitest";
import type { RatedPlayerCard } from "@sportverse/draftballer-types";
import {
  evaluateSquadQuality,
  qualityWeightBoost,
  SQUAD_TARGET_AVG_OVR,
  SQUAD_WEAK_AVG_OVR,
  squadQualityBand,
  targetMinPickOvr,
} from "./squad-quality.js";

function card(id: string, ovr: number): RatedPlayerCard {
  return {
    playerId: id,
    name: id,
    position: "CM",
    ovr,
    tier: "gold",
    stats: {},
  } as RatedPlayerCard;
}

describe("squad-quality", () => {
  it("computes target min pick OVR to stay on pace", () => {
    const target = targetMinPickOvr([80, 80, 80], 11);
    expect(target).toBeGreaterThanOrEqual(62);
    expect(target).toBeLessThanOrEqual(72);
  });

  it("empty roster does not trigger quality boost before first pick", () => {
    const pool = new Map<string, RatedPlayerCard>();
    const snap = evaluateSquadQuality([], pool, 11);
    expect(snap.filled).toBe(0);
    expect(snap.needsQualityBoost).toBe(false);
  });

  it("flags weak squads that need quality boost", () => {
    const pool = new Map([
      ["a", card("a", 58)],
      ["b", card("b", 60)],
      ["c", card("c", 59)],
    ]);
    const snap = evaluateSquadQuality(["a", "b", "c"], pool, 11);
    expect(snap.needsQualityBoost).toBe(true);
    expect(snap.band).toMatch(/at_risk|weak/);
    expect(snap.targetMinPickOvr).toBeGreaterThan(62);
  });

  it("rates completed strong squads", () => {
    const ids = Array.from({ length: 11 }, (_, i) => `p${i}`);
    const pool = new Map(ids.map((id) => [id, card(id, 76)]));
    const snap = evaluateSquadQuality(ids, pool, 11);
    expect(snap.avgOvr).toBeGreaterThanOrEqual(SQUAD_TARGET_AVG_OVR - 1);
    expect(snap.band).toBe("strong");
    expect(snap.needsQualityBoost).toBe(false);
  });

  it("weights higher-OVR picks when squad is trending weak", () => {
    const target = 70;
    expect(qualityWeightBoost(76, target)).toBeGreaterThan(qualityWeightBoost(58, target));
    expect(qualityWeightBoost(58, target)).toBeLessThan(1);
  });

  it("classifies final squad bands", () => {
    expect(squadQualityBand(SQUAD_TARGET_AVG_OVR, 0)).toBe("strong");
    expect(squadQualityBand(SQUAD_WEAK_AVG_OVR, 0)).toBe("on_track");
    expect(squadQualityBand(SQUAD_WEAK_AVG_OVR - 2, 0)).toBe("weak");
  });
});
