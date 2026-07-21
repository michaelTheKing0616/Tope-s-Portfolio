import { describe, expect, it } from "vitest";
import { createRng } from "./rng.js";
import { squadStrengths } from "./squad.js";
import { simulateMatch } from "./match.js";
import { simulateSeason, SEASON_LENGTH } from "./season.js";
import type { RatedPlayerCard, SimSquadInput } from "@sportverse/draftballer-types";

function mockPlayer(id: string, ovr: number, position: RatedPlayerCard["position"]): RatedPlayerCard {
  return {
    playerId: id,
    name: `Player ${id}`,
    nationality: "Test",
    position,
    ovr,
    tier: ovr >= 85 ? "gold_plus" : "gold",
    attributes: { pac: ovr, sho: ovr, pas: ovr, dri: ovr, def: ovr, phy: ovr },
    confidence: 0.9,
    breakdown: { clubOvrRaw: ovr, intlOvrRaw: ovr, awardBonus: 0, lens: "club_only", blendFactor: 0 },
  };
}

function mockSquad(ovr: number): SimSquadInput {
  const positions: RatedPlayerCard["position"][] = ["GK", "CB", "CB", "FB", "FB", "CM", "CM", "AM", "W", "W", "ST"];
  const players = positions.map((pos, i) => mockPlayer(`p${i}`, ovr + (i % 3) - 1, pos));
  return {
    name: "Test XI",
    playerIds: players.map((p) => p.playerId),
    players,
    squadOvr: Math.round(players.reduce((s, p) => s + p.ovr, 0) / players.length),
  };
}

describe("match-sim rng", () => {
  it("same seed produces same sequence", () => {
    const a = createRng("test-seed");
    const b = createRng("test-seed");
    const seqA = Array.from({ length: 5 }, () => a());
    const seqB = Array.from({ length: 5 }, () => b());
    expect(seqA).toEqual(seqB);
  });
});

describe("squadStrengths", () => {
  it("elite squad has higher attack than weak squad", () => {
    const elite = squadStrengths(mockSquad(88).players);
    const weak = squadStrengths(mockSquad(62).players);
    expect(elite.attack).toBeGreaterThan(weak.attack);
    expect(elite.overall).toBeGreaterThan(weak.overall);
  });
});

describe("simulateMatch", () => {
  it("deterministic for fixed seed", () => {
    const home = mockSquad(82);
    const away = mockSquad(78);
    const r1 = simulateMatch(home, away, "fixed-seed", 1);
    const r2 = simulateMatch(home, away, "fixed-seed", 1);
    expect(r1.homeGoals).toBe(r2.homeGoals);
    expect(r1.awayGoals).toBe(r2.awayGoals);
  });

  it("stronger home squad wins more often over many seeds", () => {
    let homeWins = 0;
    for (let i = 0; i < 40; i++) {
      const r = simulateMatch(mockSquad(90), mockSquad(65), `bulk-${i}`, 1);
      if (r.homeGoals > r.awayGoals) homeWins++;
    }
    expect(homeWins).toBeGreaterThan(20);
  });
});

describe("simulateSeason", () => {
  it("plays exactly 38 fixtures", async () => {
    const result = await simulateSeason(mockSquad(80), "season-test-1");
    expect(result.played).toBe(SEASON_LENGTH);
    expect(result.fixtures).toHaveLength(SEASON_LENGTH);
  });

  it("points match W/D/L record", async () => {
    const result = await simulateSeason(mockSquad(75), "season-test-2");
    expect(result.points).toBe(result.won * 3 + result.drawn);
    expect(result.won + result.drawn + result.lost).toBe(38);
  });

  it("deterministic season for same seed", async () => {
    const squad = mockSquad(84);
    const a = await simulateSeason(squad, "repeat-season");
    const b = await simulateSeason(squad, "repeat-season");
    expect(a.points).toBe(b.points);
    expect(a.goalsFor).toBe(b.goalsFor);
    expect(a.isPerfect).toBe(b.isPerfect);
  });

  it("average goals per game in realistic band", async () => {
    const result = await simulateSeason(mockSquad(78), "goals-band", {
      config: { simulationMode: "prime_powers" },
    });
    const gpg = (result.goalsFor + result.goalsAgainst) / result.played;
    expect(gpg).toBeGreaterThan(1.5);
    expect(gpg).toBeLessThan(5.5);
  });

  it("80 OVR season avoids absurd draw counts", async () => {
    let totalDraws = 0;
    let totalGf = 0;
    for (let i = 0; i < 40; i++) {
      const r = await simulateSeason(mockSquad(80), `draw-cal-${i}`);
      totalDraws += r.drawn;
      totalGf += r.goalsFor;
    }
    expect(totalDraws / 40).toBeLessThan(16);
    expect(totalDraws / 40).toBeGreaterThan(4);
    expect(totalGf / 40).toBeGreaterThan(25);
  });

  it("weak face stats with 80 OVR headline still score regularly", async () => {
    const squad = mockSquad(80);
    squad.players = squad.players.map((p) => ({
      ...p,
      attributes: {
        pac: p.ovr,
        sho: Math.max(45, p.ovr - 25),
        pas: p.ovr - 5,
        dri: p.ovr - 3,
        def: p.ovr + 5,
        phy: p.ovr,
      },
    }));
    const r = await simulateSeason(squad, "weak-attack-cal");
    expect(r.goalsFor).toBeGreaterThan(18);
    expect(r.drawn).toBeLessThan(22);
  });
});
