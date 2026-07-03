import { describe, expect, it, beforeEach } from "vitest";
import { EXPERT_PRIOR_CALIBRATION, setEngineCalibration } from "@sportverse/sports-db";
import {
  baselineShift,
  bridgeLeagueZ,
  BRIDGE_SENSITIVITY,
  scalingFactor,
  shouldApplyLeagueBridging,
  applyLeagueStrengthBridging,
} from "./league-strength.js";
import type { DraftModeConfig, PlayerAttributes } from "@sportverse/draftballer-types";
import type { PlayerSeasonStat } from "@sportverse/sports-db";

const anyLeagueMode: DraftModeConfig = {
  id: "test",
  title: "Test",
  blurb: "",
  era: "all_time",
  competitionScope: "any_league",
  ratingLens: "club_only",
  blendFactor: 0,
};

const singleLeagueMode: DraftModeConfig = {
  ...anyLeagueMode,
  competitionScope: "single_league",
  leagueId: "premier-league",
};

const rawDomesticMode: DraftModeConfig = {
  ...anyLeagueMode,
  rawDomesticDominance: true,
};

describe("LSI v1 bridging formula", () => {
  beforeEach(() => setEngineCalibration(EXPERT_PRIOR_CALIBRATION));

  it("scaling_factor matches worked example for LSI 1.15", () => {
    expect(scalingFactor(1.15)).toBeCloseTo(0.9375, 4);
  });

  it("scaling_factor hits 0.75 floor at LSI ≤ 0.4", () => {
    expect(scalingFactor(0.4)).toBe(0.75);
    expect(scalingFactor(0.5)).toBeCloseTo(0.775, 3);
  });

  it("scaling_factor hits 1.15 ceiling at LSI ≥ 2.0", () => {
    expect(scalingFactor(2.0)).toBe(1.15);
    expect(scalingFactor(1.5)).toBeCloseTo(1.025, 3);
  });

  it("baseline_shift is bounded ±3", () => {
    expect(baselineShift(0.5)).toBe(-2);
    expect(baselineShift(1.5)).toBe(2);
    expect(baselineShift(2)).toBe(3);
  });

  it("PAC/PHY have zero bridging sensitivity", () => {
    expect(BRIDGE_SENSITIVITY.pac).toBe(0);
    expect(BRIDGE_SENSITIVITY.phy).toBe(0);
  });

  it("DRI uses moderate bridging (0.7)", () => {
    const leagueZ = 2.3;
    const full = bridgeLeagueZ(leagueZ, 1.15, 1);
    const moderate = bridgeLeagueZ(leagueZ, 1.15, 0.7);
    expect(Math.abs(full - leagueZ)).toBeGreaterThan(Math.abs(moderate - leagueZ));
  });
});

describe("LSI mode gating", () => {
  it("skips bridging in single league mode", () => {
    expect(shouldApplyLeagueBridging(singleLeagueMode)).toBe(false);
  });

  it("skips bridging when Raw Domestic Dominance enabled", () => {
    expect(shouldApplyLeagueBridging(rawDomesticMode)).toBe(false);
  });

  it("applies bridging in any-league mode by default", () => {
    expect(shouldApplyLeagueBridging(anyLeagueMode)).toBe(true);
  });
});

describe("applyLeagueStrengthBridging integration", () => {
  const attrs: PlayerAttributes = { pac: 82, sho: 88, pas: 80, dri: 85, def: 45, phy: 78 };
  const stats: PlayerSeasonStat[] = [
    {
      playerId: "x",
      seasonLabel: "2020",
      competitionId: "barcelona",
      context: "CLUB",
      appearances: 35,
      goals: 25,
      assists: 8,
      minutes: 3000,
      confidence: 0.9,
    },
  ];

  it("weak-league player retains most dominance vs strong-league peer", () => {
    const macroZ = { sho: 2.3, pas: 0.6, dri: 1.0, def: -0.2, pac: 0.4, phy: 0.3 };
    const strongStats: PlayerSeasonStat[] = [
      { ...stats[0]!, competitionId: "premier-league", seasonLabel: "2020" },
    ];
    const weakStats: PlayerSeasonStat[] = [
      { ...stats[0]!, competitionId: "championship", seasonLabel: "2020" },
    ];
    const strong = applyLeagueStrengthBridging(attrs, strongStats, anyLeagueMode, "ST", "club", macroZ);
    const weak = applyLeagueStrengthBridging(attrs, weakStats, anyLeagueMode, "ST", "club", macroZ);
    expect(strong.leagueContext?.pointSwing).toBeGreaterThan(weak.leagueContext?.pointSwing ?? -99);
    expect((weak.leagueContext?.pointSwing ?? 0) > -6).toBe(true);
    expect((weak.leagueContext?.pointSwing ?? 0) < (strong.leagueContext?.pointSwing ?? 99)).toBe(true);
  });

  it("worked example: identical league_z +2.3 yields modest OVR gap (LSI 1.15 vs 0.70)", () => {
    const leagueZ = 2.3;
    const shoFromZ = (z: number, lsi: number) => {
      const globalZ = bridgeLeagueZ(leagueZ, lsi, 1);
      const rating = 50 + 20 * Math.tanh(globalZ / 1.5);
      const bs = baselineShift(lsi);
      return Math.round(rating + bs);
    };
    const strong = shoFromZ(leagueZ, 1.15);
    const weak = shoFromZ(leagueZ, 0.7);
    expect(strong - weak).toBeGreaterThan(0);
    expect(strong - weak).toBeLessThan(8);
  });

  it("returns skip reason for raw domestic dominance", () => {
    const result = applyLeagueStrengthBridging(attrs, stats, rawDomesticMode, "ST", "club");
    expect(result.leagueContext?.skipped).toBe(true);
    expect(result.leagueContext?.skipReason).toBe("raw_domestic_dominance");
  });
});
