import { describe, expect, it } from "vitest";
import { IMPUTED_MPA, MAX_PLAUSIBLE_MPA, repairSeasonMinutes } from "./minutes.js";
import type { PlayerSeasonStat } from "@sportverse/sports-db";

function row(appearances: number, minutes: number): PlayerSeasonStat {
  return {
    playerId: "p1",
    seasonLabel: "17/18",
    competitionId: "premier-league",
    context: "CLUB",
    appearances,
    goals: 10,
    assists: 5,
    minutes,
    confidence: 0.9,
  };
}

describe("repairSeasonMinutes", () => {
  it("imputes minutes for corrupted rows (regular starter with ~4 min/game)", () => {
    // Real archive corruption: Sterling 17/18 PL — 33 apps, 144 minutes.
    const repaired = repairSeasonMinutes(row(33, 144));
    expect(repaired.minutes).toBe(33 * IMPUTED_MPA);
  });

  it("keeps plausible rows untouched", () => {
    const r = row(30, 2450);
    expect(repairSeasonMinutes(r)).toBe(r);
  });

  it("keeps genuine cameo rows with few appearances", () => {
    const r = row(3, 40);
    expect(repairSeasonMinutes(r)).toBe(r);
  });

  it("caps impossible minutes-per-appearance", () => {
    const repaired = repairSeasonMinutes(row(10, 5000));
    expect(repaired.minutes).toBe(10 * MAX_PLAUSIBLE_MPA);
  });

  it("imputes missing minutes", () => {
    const repaired = repairSeasonMinutes(row(20, 0));
    expect(repaired.minutes).toBe(20 * IMPUTED_MPA);
  });
});
