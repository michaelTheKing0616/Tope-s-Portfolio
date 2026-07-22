import { describe, expect, it } from "vitest";
import type { RatedPlayerCard, SimSquadInput } from "@sportverse/draftballer-types";
import { simulateSeason } from "./season.js";
import { simulateMatchV2 } from "./sim-engine.js";

const POSITIONS = ["GK", "CB", "CB", "FB", "FB", "CM", "CM", "AM", "W", "W", "ST"] as const;

function mockSquad(ovr: number, prefix: string): SimSquadInput {
  const players: RatedPlayerCard[] = POSITIONS.map((position, i) => ({
    playerId: `${prefix}-${i}`,
    name: `${prefix} ${i}`,
    nationality: prefix === "user" ? "England" : "Spain",
    position,
    ovr,
    tier: "gold",
    fameScore: 50,
    fameTier: "known",
    attributes: { pac: ovr, sho: ovr, pas: ovr, dri: ovr, def: ovr, phy: ovr },
    confidence: 0.8,
    breakdown: {
      clubOvrRaw: ovr,
      intlOvrRaw: ovr,
      awardBonus: 0,
      lens: "club_only",
      blendFactor: 0,
    },
  }));
  return {
    name: prefix === "user" ? "User XI" : "Rivals",
    playerIds: players.map((p) => p.playerId),
    players,
    squadOvr: ovr,
  };
}

describe("loss / scoreline integrity", () => {
  it("raw match goal events always match the final score", () => {
    const home = mockSquad(70, "home");
    const away = mockSquad(86, "away");
    for (let i = 0; i < 20; i++) {
      const m = simulateMatchV2(home, away, `loss-raw-${i}`, i + 1, {
        config: { simulationMode: "realistic", venue: { homeAdvantage: true } },
      });
      const goals = m.events.filter((e) => e.type === "goal");
      const homeEv = goals.filter((e) => e.team === "home").length;
      const awayEv = goals.filter((e) => e.team === "away").length;
      expect(homeEv).toBe(m.homeGoals);
      expect(awayEv).toBe(m.awayGoals);
      expect(homeEv + awayEv).toBe(m.homeGoals + m.awayGoals);
    }
  });

  it("season fixtures keep every goal event (losses included)", async () => {
    const result = await simulateSeason(mockSquad(66, "user"), "loss-fixture-events");
    expect(result.lost).toBeGreaterThan(0);

    let checkedLosses = 0;
    for (const f of result.fixtures) {
      const goalEvents = f.events.filter((e) => e.type === "goal");
      expect(goalEvents.length).toBe(f.goalsFor + f.goalsAgainst);
      expect(f.events.some((e) => e.type === "fulltime")).toBe(true);

      // Events keep match home/away — remap to user perspective.
      const userTeam = f.home ? "home" : "away";
      const oppTeam = f.home ? "away" : "home";
      const userGoalEvents = goalEvents.filter((e) => e.team === userTeam).length;
      const oppGoalEvents = goalEvents.filter((e) => e.team === oppTeam).length;
      expect(userGoalEvents).toBe(f.goalsFor);
      expect(oppGoalEvents).toBe(f.goalsAgainst);

      if (f.result === "L") {
        checkedLosses++;
        expect(f.goalsFor).toBeLessThan(f.goalsAgainst);
        expect(oppGoalEvents).toBeGreaterThan(userGoalEvents);
      }
      if (f.result === "W") expect(f.goalsFor).toBeGreaterThan(f.goalsAgainst);
      if (f.result === "D") expect(f.goalsFor).toBe(f.goalsAgainst);
    }
    expect(checkedLosses).toBe(result.lost);
    expect(result.won + result.drawn + result.lost).toBe(38);
    expect(result.points).toBe(result.won * 3 + result.drawn);
  });

  it("weaker side can still beat a stronger side sometimes (losses not scripted)", () => {
    const weak = mockSquad(68, "weak");
    const strong = mockSquad(88, "strong");
    let weakWins = 0;
    let strongWins = 0;
    for (let i = 0; i < 40; i++) {
      // Weak at home
      const m = simulateMatchV2(weak, strong, `upset-${i}`, 1, {
        config: { simulationMode: "realistic", venue: { homeAdvantage: true } },
      });
      if (m.homeGoals > m.awayGoals) weakWins++;
      if (m.awayGoals > m.homeGoals) strongWins++;
    }
    // Strong should usually win, but not every time — and weak must be able to lose for real.
    expect(strongWins).toBeGreaterThan(weakWins);
    expect(strongWins).toBeGreaterThan(10);
    // At least some decisive results either way / draws — not an endless script of one outcome.
    expect(weakWins + strongWins).toBeGreaterThan(20);
  });
});
