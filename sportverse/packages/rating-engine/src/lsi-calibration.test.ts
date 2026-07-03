import { describe, expect, it, beforeEach } from "vitest";
import { EXPERT_PRIOR_CALIBRATION, setEngineCalibration } from "@sportverse/sports-db";
import { computePlayerRating } from "./compute.js";
import type { DraftModeConfig } from "@sportverse/draftballer-types";
import type { PlayerSeasonStat } from "@sportverse/sports-db";
import { applyLeagueStrengthBridging, bridgeLeagueZ, scalingFactor } from "./league-strength.js";
import type { PlayerAttributes } from "@sportverse/draftballer-types";

const anyLeague: DraftModeConfig = {
  id: "t",
  title: "T",
  blurb: "",
  era: "all_time",
  competitionScope: "any_league",
  ratingLens: "club_only",
  blendFactor: 0,
};

const plStats: PlayerSeasonStat[] = [
  {
    playerId: "pl-st",
    seasonLabel: "2020",
    competitionId: "premier-league",
    context: "CLUB",
    appearances: 38,
    goals: 22,
    assists: 6,
    minutes: 3200,
    confidence: 0.92,
  },
];

const weakStats: PlayerSeasonStat[] = [
  {
    playerId: "ch-st",
    seasonLabel: "2020",
    competitionId: "championship",
    context: "CLUB",
    appearances: 38,
    goals: 22,
    assists: 6,
    minutes: 3200,
    confidence: 0.88,
  },
];

describe("LSI calibration — bounded and fair", () => {
  beforeEach(() => setEngineCalibration(EXPERT_PRIOR_CALIBRATION));

  it("weak league (LSI ~0.74) penalizes less than 6 OVR vs elite league for same production", () => {
    const pl = computePlayerRating(
      { id: "pl-st", name: "PL Striker", position: "Forward", seasonStats: plStats },
      anyLeague,
    );
    const ch = computePlayerRating(
      { id: "ch-st", name: "Championship Striker", position: "Forward", seasonStats: weakStats },
      anyLeague,
    );
    const gap = pl.ovr - ch.ovr;
    expect(gap).toBeGreaterThan(0);
    expect(gap).toBeLessThan(6);
    const swing = ch.breakdown.leagueContext?.pointSwing;
    if (swing != null) expect(swing).toBeGreaterThan(-6);
  });

  it("identical within-league z (+2.3) stays within design band across LSI 1.15 vs 0.70", () => {
    const z = 2.3;
    const strongRating = 50 + 20 * Math.tanh(bridgeLeagueZ(z, 1.15, 1) / 1.5);
    const weakRating = 50 + 20 * Math.tanh(bridgeLeagueZ(z, 0.7, 1) / 1.5);
    expect(strongRating - weakRating).toBeGreaterThan(0);
    expect(strongRating - weakRating).toBeLessThan(7);
  });

  it("scaling floor LSI 0.55 retains ≥0.787 effective scale", () => {
    expect(scalingFactor(0.55)).toBeCloseTo(0.7875, 3);
    const attrs: PlayerAttributes = { pac: 80, sho: 85, pas: 70, dri: 78, def: 40, phy: 75 };
    const macroZ = { sho: 2.3, pas: 0.5, dri: 0.8, def: -0.2, pac: 0.3, phy: 0.2 };
    const result = applyLeagueStrengthBridging(attrs, weakStats, anyLeague, "ST", "club", macroZ);
    const localSho = 50 + 20 * Math.tanh(2.3 / 1.5);
    const bridgedSho = 50 + 20 * Math.tanh((2.3 * scalingFactor(0.74)) / 1.5);
    expect(result.attrs.sho).toBeCloseTo(bridgedSho, 0);
    expect(result.attrs.sho).toBeGreaterThan(localSho - 8);
    expect(result.leagueContext?.pointSwing ?? 0).toBeGreaterThan(-6);
  });
});
