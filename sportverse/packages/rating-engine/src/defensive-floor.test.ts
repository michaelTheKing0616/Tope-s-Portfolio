import { describe, expect, it } from "vitest";
import type { PlayerSeasonStat } from "@sportverse/sports-db";
import { defensiveWorkloadFloor } from "./stats-rating.js";
import { seasonScore } from "./peak-weighting.js";

function row(partial: Partial<PlayerSeasonStat> & Pick<PlayerSeasonStat, "appearances" | "goals">): PlayerSeasonStat {
  return {
    playerId: "p1",
    seasonLabel: "2018",
    competitionId: "liga-portugal",
    context: "CLUB",
    assists: 0,
    minutes: (partial.appearances ?? 1) * 85,
    confidence: 0.9,
    ...partial,
  };
}

describe("defensive rating floors", () => {
  it("scores high-minute defender seasons above low-G/A cup cameos", () => {
    const starter = seasonScore(row({ appearances: 34, goals: 1, assists: 3, minutes: 3000 }), "FB");
    const cameo = seasonScore(row({ appearances: 2, goals: 2, assists: 0, minutes: 120 }), "FB");
    expect(starter).toBeGreaterThan(cameo);
  });

  it("gives multi-season fullbacks a mid-70s workload floor", () => {
    expect(defensiveWorkloadFloor(100, 8500, "FB")).toBeGreaterThanOrEqual(74);
    expect(defensiveWorkloadFloor(60, 4800, "CB")).toBeGreaterThanOrEqual(70);
    expect(defensiveWorkloadFloor(35, 2800, "FB")).toBeGreaterThanOrEqual(66);
    expect(defensiveWorkloadFloor(5, 200, "FB")).toBe(0);
  });
});
