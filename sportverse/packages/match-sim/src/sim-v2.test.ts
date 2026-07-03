import { describe, expect, it } from "vitest";
import { computePhysicalityFitTerm, buildFitSummary } from "./fit-model.js";
import { computePlayerMeta } from "./player-meta.js";
import { getEraProfile } from "./era-profiles.js";
import { simulateMatchV2 } from "./sim-engine.js";
import { zoneOverloadModifier } from "./formations.js";
import type { RatedPlayerCard, SimSquadInput } from "@sportverse/draftballer-types";
import { DEFAULT_SIM_CONFIG } from "@sportverse/draftballer-types";

function mockPlayer(id: string, attrs: Partial<RatedPlayerCard["attributes"]>, position: RatedPlayerCard["position"]): RatedPlayerCard {
  const base = { pac: 50, sho: 50, pas: 50, dri: 50, def: 50, phy: 50, ...attrs };
  const ovr = Math.round((base.pac + base.sho + base.pas + base.dri + base.def + base.phy) / 6);
  return {
    playerId: id,
    name: id,
    nationality: "Test",
    position,
    ovr,
    tier: "gold",
    attributes: base,
    confidence: 0.9,
    breakdown: { clubOvrRaw: ovr, intlOvrRaw: ovr, awardBonus: 0, lens: "club_only", blendFactor: 0 },
  };
}

function mockSquad(players: RatedPlayerCard[]): SimSquadInput {
  return {
    name: "Test",
    playerIds: players.map((p) => p.playerId),
    players,
    squadOvr: Math.round(players.reduce((s, p) => s + p.ovr, 0) / players.length),
  };
}

describe("sim engine v2 — era fit", () => {
  it("technical player penalized in 1970s hard men era", () => {
    const era = getEraProfile("1970s-80s");
    const technical = mockPlayer("tech", { dri: 90, pas: 88, phy: 45, def: 40 }, "AM");
    const meta = computePlayerMeta(technical);
    const term = computePhysicalityFitTerm(era, technical.attributes, meta);
    expect(term).toBeLessThan(0);
  });

  it("physical player rewarded in 1970s hard men era", () => {
    const era = getEraProfile("1970s-80s");
    const gritty = mockPlayer("grit", { phy: 90, def: 85, dri: 45, pas: 50 }, "CB");
    const meta = computePlayerMeta(gritty);
    const term = computePhysicalityFitTerm(era, gritty.attributes, meta);
    expect(term).toBeGreaterThan(0);
  });

  it("3-4-3 gains wide overload vs 4-4-2", () => {
    const mod = zoneOverloadModifier("3-4-3", "4-4-2", "att_left");
    expect(mod).toBeGreaterThan(0);
  });

  it("realistic sim produces fit report and DC goal-rate model", () => {
    const positions: RatedPlayerCard["position"][] = ["GK", "CB", "CB", "FB", "FB", "CM", "CM", "AM", "W", "W", "ST"];
    const players = positions.map((pos, i) => mockPlayer(`p${i}`, { sho: 70 + i, phy: 60 + i }, pos));
    const home = mockSquad(players);
    const away = mockSquad(players.map((p, i) => ({ ...p, playerId: `a${i}`, ovr: p.ovr - 5 })));
    const result = simulateMatchV2(home, away, "fit-test", 1, {
      config: {
        ...DEFAULT_SIM_CONFIG,
        eraContext: { mode: "custom", profileId: "1970s-80s" },
        formationHomeId: "3-4-3",
        formationAwayId: "4-4-2",
      },
    });
    expect(result.simulationMode).toBe("realistic");
    expect(result.eraProfileId).toBe("1970s-80s");
    expect(result.fitReport.length).toBeGreaterThan(0);
    expect(result.preMatchHeadline).toBeTruthy();
    expect(result.goalRateModel).toBeDefined();
    expect(result.homeGoals).toBe(result.goalRateModel!.targetHomeGoals);
    expect(result.awayGoals).toBe(result.goalRateModel!.targetAwayGoals);
  });

  it("prime powers mode skips fit report", () => {
    const positions: RatedPlayerCard["position"][] = ["GK", "CB", "CB", "FB", "FB", "CM", "CM", "AM", "W", "W", "ST"];
    const players = positions.map((pos, i) => mockPlayer(`p${i}`, {}, pos));
    const result = simulateMatchV2(mockSquad(players), mockSquad(players), "prime", 1, {
      config: { ...DEFAULT_SIM_CONFIG, simulationMode: "prime_powers" },
    });
    expect(result.simulationMode).toBe("prime_powers");
    expect(result.fitReport).toHaveLength(0);
  });
});

describe("fit summary", () => {
  it("generates over/underperform tags", () => {
    const era = getEraProfile("1970s-80s");
    const meta = computePlayerMeta(mockPlayer("x", { dri: 90, pas: 90, phy: 40, def: 40 }, "AM"));
    const under = buildFitSummary(82, 70, era, meta);
    expect(under.delta).toBe(-12);
    expect(under.tags).toContain("underperformed");
  });
});
