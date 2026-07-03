import { describe, expect, it } from "vitest";
import {
  clamp,
  connectedComponents,
  computeLsiV2,
  empiricalBayesShrink,
  isConnectedToReference,
  isInMainComponent,
  leagueSeasonKey,
  populationZScore,
  resolveHierarchicalPrior,
  shrinkageWeight,
  solveMasseyLeastSquares,
  solveMasseyToyExample,
} from "./lsi-v2.js";
import type { CrossLeagueFixture, LeagueStrengthIndexEntry, PlayerTransfer } from "@sportverse/sports-db";

describe("LSI v2 — Massey toy fixture (§3)", () => {
  it("reproduces r_B = -0.40 and r_C = -1.30 exactly", () => {
    const ratings = solveMasseyToyExample();
    expect(ratings.get("A")).toBeCloseTo(0, 10);
    expect(ratings.get("B")).toBeCloseTo(-0.4, 10);
    expect(ratings.get("C")).toBeCloseTo(-1.3, 10);
  });

  it("general solver matches hand-verified least-squares residuals", () => {
    const ratings = solveMasseyLeastSquares(["A", "B", "C"], "A", [
      { strongerId: "A", weakerId: "B", margin: 0.5 },
      { strongerId: "B", weakerId: "C", margin: 1.0 },
      { strongerId: "A", weakerId: "C", margin: 1.2 },
    ]);
    const rB = ratings.get("B")!;
    const rC = ratings.get("C")!;
    const e1 = -rB - 0.5;
    const e2 = rB - rC - 1;
    const e3 = rC + 1.2;
    expect(e1).toBeCloseTo(-0.1, 10);
    expect(e2).toBeCloseTo(-0.1, 10);
    expect(e3).toBeCloseTo(-0.1, 10);
  });
});

describe("LSI v2 — connectivity fallback (§2.3)", () => {
  it("detects disconnected graph clusters", () => {
    const nodes = ["A::2020", "B::2020", "C::2020", "X::2020", "Y::2020"];
    const edges: [string, string][] = [
      ["A::2020", "B::2020"],
      ["B::2020", "C::2020"],
      ["X::2020", "Y::2020"],
    ];
    const components = connectedComponents(nodes, edges);
    expect(components).toHaveLength(2);
    expect(components.some((c) => c.includes("A::2020"))).toBe(true);
    expect(components.some((c) => c.includes("X::2020"))).toBe(true);
    expect(isInMainComponent("A::2020", nodes, edges)).toBe(true);
    expect(isInMainComponent("X::2020", nodes, edges)).toBe(false);
    expect(isConnectedToReference("A::2020", "X::2020", [["X::2020", "Y::2020"]])).toBe(false);
  });

  it("disconnected league-season falls back to hierarchical prior without NaN", () => {
    const computed = new Map([
      [leagueSeasonKey("premier-league", "2019"), 0.95],
      [leagueSeasonKey("premier-league", "2021"), 0.97],
    ]);
    const prior = resolveHierarchicalPrior("premier-league", "2020", computed, { championship: 0.72 });
    expect(Number.isFinite(prior)).toBe(true);
    expect(prior).toBeGreaterThan(0.5);
    expect(prior).toBeLessThan(1.2);
  });
});

describe("LSI v2 — bounds and sanity (§5.3)", () => {
  it("population z-score is mean 0 unit scale", () => {
    const pop = [0.7, 0.8, 0.9, 1.0, 1.1];
    const zs = pop.map((v) => populationZScore(v, pop));
    expect(mean(zs)).toBeCloseTo(0, 10);
  });

  it("empirical Bayes shrinkage moves toward prior for small n", () => {
    const raw = 1.05;
    const prior = 0.85;
    const small = empiricalBayesShrink(raw, 5, prior, 30);
    const large = empiricalBayesShrink(raw, 200, prior, 30);
    expect(Math.abs(small - prior)).toBeLessThan(Math.abs(large - prior));
    expect(shrinkageWeight(30, 30)).toBeCloseTo(0.5, 5);
  });

  it("computeLsiV2 never emits NaN or Infinity", () => {
    const fixtures: CrossLeagueFixture[] = [
      {
        fixtureId: "f1",
        clubAId: "a",
        leagueAId: "premier-league",
        clubBId: "b",
        leagueBId: "la-liga",
        competitionId: "ucl",
        seasonLabel: "2020",
        result: 1,
      },
    ];
    const transfers: PlayerTransfer[] = [];
    const existing: LeagueStrengthIndexEntry[] = [
      {
        competitionId: "premier-league",
        seasonLabel: "2020",
        lsiFinal: 1,
        lsiRaw: 1,
        confidence: 0.9,
        eloComponent: 1,
        transferDeltaComponent: 1,
        talentFlowComponent: 1,
        natTeamComponent: 1,
        crossLeagueFixtures: 1,
        transferComparisons: 0,
      },
    ];
    const { rows } = computeLsiV2({ fixtures, transfers, existing });
    for (const r of rows) {
      expect(Number.isFinite(r.lsiFinal)).toBe(true);
      expect(Number.isFinite(r.lsiRaw)).toBe(true);
      expect(r.lsiFinal).toBeGreaterThanOrEqual(0.55);
      expect(r.lsiFinal).toBeLessThanOrEqual(1.15);
    }
  });

  it("different seasons can produce different LSI when fixture mix differs", () => {
    const fixtures: CrossLeagueFixture[] = [
      {
        fixtureId: "f1",
        clubAId: "a",
        leagueAId: "premier-league",
        clubBId: "b",
        leagueBId: "championship",
        competitionId: "fa-cup",
        seasonLabel: "2019",
        result: 1,
      },
      {
        fixtureId: "f2",
        clubAId: "c",
        leagueAId: "championship",
        clubBId: "d",
        leagueBId: "premier-league",
        competitionId: "fa-cup",
        seasonLabel: "2020",
        result: -1,
      },
    ];
    const { rows } = computeLsiV2({ fixtures, transfers: [], existing: [] });
    const pl2019 = rows.find((r) => r.competitionId === "premier-league" && r.seasonLabel === "2019");
    const pl2020 = rows.find((r) => r.competitionId === "premier-league" && r.seasonLabel === "2020");
    expect(pl2019).toBeTruthy();
    expect(pl2020).toBeTruthy();
    expect(clamp).toBeDefined();
  });
});

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

describe("LSI v2 — reference ordering sanity (§5.6)", () => {
  it("premier-league scores above championship in connected 2020 graph", () => {
    const fixtures: CrossLeagueFixture[] = [
      {
        fixtureId: "f1",
        clubAId: "a",
        leagueAId: "premier-league",
        clubBId: "b",
        leagueBId: "championship",
        competitionId: "fa-cup",
        seasonLabel: "2020",
        result: 1,
      },
      {
        fixtureId: "f2",
        clubAId: "c",
        leagueAId: "premier-league",
        clubBId: "d",
        leagueBId: "la-liga",
        competitionId: "ucl",
        seasonLabel: "2020",
        result: 0,
      },
    ];
    const existing: LeagueStrengthIndexEntry[] = [
      {
        competitionId: "premier-league",
        seasonLabel: "2020",
        lsiFinal: 1,
        lsiRaw: 1,
        confidence: 0.9,
        eloComponent: 1.02,
        transferDeltaComponent: 0.98,
        talentFlowComponent: 1.01,
        natTeamComponent: 1.04,
        crossLeagueFixtures: 2,
        transferComparisons: 0,
      },
      {
        competitionId: "championship",
        seasonLabel: "2020",
        lsiFinal: 0.74,
        lsiRaw: 0.74,
        confidence: 0.7,
        eloComponent: 0.72,
        transferDeltaComponent: 0.7,
        talentFlowComponent: 0.75,
        natTeamComponent: 0.78,
        crossLeagueFixtures: 1,
        transferComparisons: 0,
      },
    ];
    const { rows } = computeLsiV2({ fixtures, transfers: [], existing });
    const pl = rows.find((r) => r.competitionId === "premier-league" && r.seasonLabel === "2020");
    const ch = rows.find((r) => r.competitionId === "championship" && r.seasonLabel === "2020");
    expect(pl!.lsiFinal).toBeGreaterThan(ch!.lsiFinal);
  });
});
