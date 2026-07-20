import { describe, expect, it } from "vitest";
import type { PlayerSeasonStat } from "@sportverse/sports-db";
import { peakWeightStats, PEAK_SEASON_MIN_APPS } from "./peak-weighting.js";

function row(
  partial: Partial<PlayerSeasonStat> & Pick<PlayerSeasonStat, "seasonLabel" | "appearances" | "goals">,
): PlayerSeasonStat {
  return {
    playerId: "p1",
    competitionId: "test-league",
    context: "CLUB",
    assists: 0,
    minutes: (partial.appearances ?? 1) * 80,
    confidence: 0.9,
    ...partial,
  };
}

describe("peakWeightStats — cup-cameo firewall", () => {
  it("rejects 1-app brace seasons in favor of real league campaigns", () => {
    // Hand scenario: 2 goals in 1 cup app (GPG=2) vs 15 goals in 33 league apps (GPG≈0.45).
    // Without min-apps, cup wins; with floor, league wins.
    const peak = peakWeightStats(
      [
        row({ seasonLabel: "cup", competitionId: "cup", appearances: 1, goals: 2 }),
        row({ seasonLabel: "league", competitionId: "league", appearances: 33, goals: 15, assists: 4 }),
        row({ seasonLabel: "league2", competitionId: "league", appearances: 30, goals: 10, assists: 2 }),
        row({ seasonLabel: "league3", competitionId: "league", appearances: 28, goals: 8 }),
        row({ seasonLabel: "league4", competitionId: "league", appearances: 25, goals: 6 }),
        row({ seasonLabel: "thin", competitionId: "cup", appearances: 2, goals: 2 }),
      ],
      4,
    );
    expect(PEAK_SEASON_MIN_APPS).toBe(10);
    expect(peak.every((s) => s.appearances >= PEAK_SEASON_MIN_APPS)).toBe(true);
    expect(peak.some((s) => s.seasonLabel === "league")).toBe(true);
    expect(peak.some((s) => s.seasonLabel === "cup")).toBe(false);
  });
});
