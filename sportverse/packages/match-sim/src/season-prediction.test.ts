import { describe, expect, it } from "vitest";
import { gradeSeasonVsPrediction, predictSeasonOutlook } from "./season-prediction.js";
import type { RatedPlayerCard, SeasonSimResult } from "@sportverse/draftballer-types";

function mockPlayer(ovr: number, id = "p1", name = "Star"): RatedPlayerCard {
  return {
    playerId: id,
    name,
    nationality: "Test",
    position: "ST",
    ovr,
    tier: "gold",
    attributes: { pac: ovr, sho: ovr, pas: ovr, dri: ovr, def: ovr, phy: ovr },
    confidence: 0.9,
    breakdown: { clubOvrRaw: ovr, intlOvrRaw: ovr, awardBonus: 0, lens: "club_only", blendFactor: 0 },
  };
}

describe("season prediction — layman preview", () => {
  it("elite XI projects more points than average XI", () => {
    const elite = predictSeasonOutlook(
      { squadOvr: 86, players: Array.from({ length: 11 }, (_, i) => mockPlayer(86, `e${i}`, `E${i}`)) },
      72,
    );
    const average = predictSeasonOutlook(
      { squadOvr: 72, players: Array.from({ length: 11 }, (_, i) => mockPlayer(72, `a${i}`, `A${i}`)) },
      72,
    );
    expect(elite.expectedPoints).toBeGreaterThan(average.expectedPoints);
    expect(elite.outlookTier).not.toBe("relegation_battle");
  });

  it("hand-check: +8 strength delta yields mid-table-ish projection", () => {
    const squad = predictSeasonOutlook(
      { squadOvr: 80, players: Array.from({ length: 11 }, (_, i) => mockPlayer(80, `p${i}`)) },
      72,
    );
    expect(squad.expectedWins + squad.expectedDraws + squad.expectedLosses).toBe(38);
    expect(squad.expectedPoints).toBeGreaterThan(45);
    expect(squad.expectedPoints).toBeLessThan(95);
  });
});

describe("season expectation grade", () => {
  const prediction = predictSeasonOutlook(
    { squadOvr: 78, players: Array.from({ length: 11 }, (_, i) => mockPlayer(78, `p${i}`)) },
    72,
  );

  function actual(overrides: Partial<SeasonSimResult>): SeasonSimResult {
    return {
      played: 38,
      won: 12,
      drawn: 10,
      lost: 16,
      points: 46,
      goalsFor: 48,
      goalsAgainst: 55,
      goalDifference: -7,
      fixtures: [],
      isUnbeaten: false,
      isPerfect: false,
      seed: "t",
      prediction,
      ...overrides,
    };
  }

  it("labels clear overperformance", () => {
    const grade = gradeSeasonVsPrediction(
      actual({ points: prediction.expectedPoints + 10, won: prediction.expectedWins + 3, goalDifference: 12 }),
      prediction,
    );
    expect(["overperformed", "exceeded", "slightly_above"]).toContain(grade.grade);
  });

  it("labels met expectations when close", () => {
    const grade = gradeSeasonVsPrediction(
      actual({ points: prediction.expectedPoints, goalDifference: prediction.expectedGoalDifference }),
      prediction,
    );
    expect(grade.grade).toBe("met");
  });

  it("labels underperformance when far below", () => {
    const grade = gradeSeasonVsPrediction(
      actual({ points: prediction.expectedPoints - 14, won: prediction.expectedWins - 5, goalDifference: -20 }),
      prediction,
    );
    expect(["underperformed", "underwhelmed"]).toContain(grade.grade);
  });
});
