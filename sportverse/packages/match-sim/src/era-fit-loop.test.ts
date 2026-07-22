import { describe, expect, it } from "vitest";
import type { RatedPlayerCard, SimSquadInput } from "@sportverse/draftballer-types";
import { DEFAULT_SIM_CONFIG } from "@sportverse/draftballer-types";
import { buildFitSummary, computeSquadFitReport, fitPreviewHeadline } from "./fit-model.js";
import { computePlayerMeta } from "./player-meta.js";
import { getEraProfile } from "./era-profiles.js";
import { simulateSeason } from "./season.js";

function mockPlayer(
  id: string,
  attrs: Partial<RatedPlayerCard["attributes"]>,
  position: RatedPlayerCard["position"],
): RatedPlayerCard {
  const base = { pac: 70, sho: 70, pas: 70, dri: 70, def: 50, phy: 50, ...attrs };
  const ovr = Math.round((base.pac + base.sho + base.pas + base.dri + base.def + base.phy) / 6);
  return {
    playerId: id,
    name: id,
    nationality: "Test",
    position,
    ovr,
    tier: "gold",
    fameScore: 50,
    fameTier: "known",
    attributes: base,
    confidence: 0.9,
    breakdown: { clubOvrRaw: ovr, intlOvrRaw: ovr, awardBonus: 0, lens: "club_only", blendFactor: 0 },
  };
}

/** All-technical XI — high dri/pas, low phy — should suffer in 1970s mud. */
function technicalXi(): SimSquadInput {
  const positions: RatedPlayerCard["position"][] = [
    "GK",
    "CB",
    "CB",
    "FB",
    "FB",
    "CM",
    "CM",
    "AM",
    "W",
    "W",
    "ST",
  ];
  const players = positions.map((pos, i) =>
    mockPlayer(
      `tech${i}`,
      { dri: 88, pas: 86, phy: 42, def: pos === "GK" || pos === "CB" ? 70 : 45, sho: 75, pac: 80 },
      pos,
    ),
  );
  return {
    name: "Technicians",
    playerIds: players.map((p) => p.playerId),
    players,
    squadOvr: Math.round(players.reduce((s, p) => s + p.ovr, 0) / players.length),
  };
}

describe("era fit loop — Phase 2 acceptance", () => {
  it("plain-language tags: technical mismatch → bullied copy", () => {
    const era = getEraProfile("1970s-80s");
    const tech = mockPlayer("t", { dri: 90, pas: 90, phy: 40, def: 40 }, "AM");
    const meta = computePlayerMeta(tech);
    // Hand calc: base 82, effective 70 → delta -12; TRI high + physicality 0.9 → technical_mismatch
    const under = buildFitSummary(82, 70, era, meta);
    expect(under.tags).toContain("technical_mismatch");
    expect(under.tags).toContain("underperformed");
    expect(under.summary).toMatch(/Bullied off the ball/i);
  });

  it("computeSquadFitReport sorts by |delta| and exposes per-player lines", () => {
    const era = getEraProfile("1970s-80s");
    const squad = technicalXi();
    const report = computeSquadFitReport(squad.players, era, "balanced");
    expect(report).toHaveLength(11);
    for (let i = 1; i < report.length; i++) {
      expect(Math.abs(report[i - 1]!.effectiveDelta)).toBeGreaterThanOrEqual(
        Math.abs(report[i]!.effectiveDelta),
      );
    }
    expect(fitPreviewHeadline(squad.players, era)).toMatch(/struggle|mud|neutral/i);
  });

  it("all-technical XI earns fewer points in 1970s than Modern over 20 seeded runs", async () => {
    const squad = technicalXi();
    let points70s = 0;
    let pointsModern = 0;
    const runs = 20;
    for (let i = 0; i < runs; i++) {
      const seed = `era-loop-${i}`;
      const r70 = await simulateSeason(squad, seed, {
        config: {
          ...DEFAULT_SIM_CONFIG,
          simulationMode: "realistic",
          eraContext: { mode: "custom", profileId: "1970s-80s" },
          weather: "clear",
        },
      });
      const r20 = await simulateSeason(squad, seed, {
        config: {
          ...DEFAULT_SIM_CONFIG,
          simulationMode: "realistic",
          eraContext: { mode: "custom", profileId: "2020s" },
          weather: "clear",
        },
      });
      points70s += r70.points;
      pointsModern += r20.points;
      expect(r70.seed).toBe(`${seed}:sim:1970s-80s`);
      expect(r20.seed).toBe(`${seed}:sim:2020s`);
      expect(r70.seasonFitReport?.length).toBeGreaterThan(0);
    }
    // Measurably worse W-D-L / points in the hard-men era.
    expect(points70s).toBeLessThan(pointsModern);
  });

  it("Prime Powers OFF (prime_powers mode) snapshot is deterministic for fixed seed", async () => {
    const squad = technicalXi();
    const seed = "prime-snapshot-v1";
    const cfg = {
      ...DEFAULT_SIM_CONFIG,
      simulationMode: "prime_powers" as const,
      weather: "clear" as const,
    };
    const a = await simulateSeason(squad, seed, { config: cfg });
    const b = await simulateSeason(squad, seed, { config: cfg });
    expect(a.seed).toBe(`${seed}:sim:prime_powers`);
    expect(a.won).toBe(b.won);
    expect(a.drawn).toBe(b.drawn);
    expect(a.lost).toBe(b.lost);
    expect(a.points).toBe(b.points);
    expect(a.goalsFor).toBe(b.goalsFor);
    expect(a.goalsAgainst).toBe(b.goalsAgainst);
    expect(a.seasonFitReport).toEqual([]);
    // Snapshot fixture for technicalXi + seed prime-snapshot-v1 — update only if prime_powers path intentionally changes.
    // Updated for league-structured opponents (season realism recalibration).
    expect({ w: a.won, d: a.drawn, l: a.lost, pts: a.points, gf: a.goalsFor, ga: a.goalsAgainst }).toEqual({
      w: 20,
      d: 5,
      l: 13,
      pts: 65,
      gf: 109,
      ga: 55,
    });
  });
});
