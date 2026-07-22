import { describe, expect, it, beforeEach } from "vitest";
import type { DraftModeConfig } from "@sportverse/draftballer-types";
import type { PlayerSeasonStat } from "@sportverse/sports-db";
import { computePlayerRating } from "./compute.js";
import { setEaFc26Index } from "./ea-ratings.js";
import {
  blendWithHistoricalCalibration,
  careerWorkloadToPeakOvr,
  establishedProfessionalFloor,
  peakMvToTier2Ovr,
  setHistoricalRatingsIndex,
  getHistoricalRating,
} from "./historical-ratings.js";
import { setAwardsData } from "./awards.js";
import { setFameDataForRatings } from "./fame-data.js";

const allTimeMode: DraftModeConfig = {
  id: "est-pro-test",
  title: "All-Time",
  blurb: "",
  era: "all_time",
  competitionScope: "any_league",
  ratingLens: "club_only",
  blendFactor: 0,
};

function topFlightSeason(
  playerId: string,
  seasonLabel: string,
  appearances: number,
  goals = 1,
  assists = 1,
): PlayerSeasonStat {
  return {
    playerId,
    seasonLabel,
    competitionId: "premier-league",
    context: "CLUB",
    appearances,
    goals,
    assists,
    minutes: appearances * 72,
    confidence: 0.85,
  };
}

beforeEach(() => {
  setEaFc26Index([]);
  setHistoricalRatingsIndex([]);
  setAwardsData([], []);
  setFameDataForRatings([]);
});

describe("historical-ratings", () => {
  it("peakMvToTier2Ovr maps era MV share to sensible prime floors", () => {
    expect(peakMvToTier2Ovr(0)).toBe(0);
    expect(peakMvToTier2Ovr(7)).toBe(0);
    expect(peakMvToTier2Ovr(8)).toBeGreaterThanOrEqual(62);
    expect(peakMvToTier2Ovr(25)).toBeGreaterThanOrEqual(68);
    expect(peakMvToTier2Ovr(50)).toBeGreaterThanOrEqual(75);
    expect(peakMvToTier2Ovr(90)).toBeLessThanOrEqual(91);
  });

  it("careerWorkloadToPeakOvr mirrors tier-3 build thresholds", () => {
    expect(careerWorkloadToPeakOvr(10, 500)).toBe(0);
    expect(careerWorkloadToPeakOvr(15, 900)).toBe(65);
    expect(careerWorkloadToPeakOvr(60, 4500)).toBe(72);
  });

  it("blendWithHistoricalCalibration floors weak stats at historical peak", () => {
    const entry = { playerId: "tm-test", peakOvr: 84, source: "peak_mv_tier2" as const };
    const low = blendWithHistoricalCalibration(62, entry);
    expect(low.ovr).toBeGreaterThanOrEqual(84);
    expect(low.uplift).toBeGreaterThan(0);

    const high = blendWithHistoricalCalibration(88, entry);
    expect(high.ovr).toBeGreaterThanOrEqual(88);
  });

  it("blendWithHistoricalCalibration rescues attenuated tier-3 anchors below 64", () => {
    const entry = {
      playerId: "tier3-low",
      peakOvr: 58,
      source: "career_workload_tier3" as const,
      careerApps: 80,
      careerMinutes: 6000,
    };
    const blended = blendWithHistoricalCalibration(54, entry);
    expect(blended.peakOvr).toBeGreaterThanOrEqual(64);
    expect(blended.ovr).toBeGreaterThanOrEqual(64);
  });

  it("establishedProfessionalFloor scales with sustained top-flight volume", () => {
    const longCareer = Array.from({ length: 8 }, (_, i) =>
      topFlightSeason("established-cm", String(2010 + i), 18, 0, 2),
    );
    const fringe = [topFlightSeason("fringe-cm", "2020", 8, 0, 0)];

    expect(establishedProfessionalFloor(longCareer)).toBeGreaterThanOrEqual(64);
    expect(establishedProfessionalFloor(fringe)).toBe(0);
  });

  it("eight top-flight seasons without calibration stay at or above 64 OVR", () => {
    const stats = Array.from({ length: 8 }, (_, i) =>
      topFlightSeason("established-cm", String(2008 + i), 18, 0, 2),
    );
    const card = computePlayerRating(
      { id: "established-cm", name: "Established CM", position: "CM", seasonStats: stats },
      allTimeMode,
    );
    expect(card.ovr).toBeGreaterThanOrEqual(64);
  });

  it("one-season fringe player stays below established floor", () => {
    const stats = [topFlightSeason("fringe-fb", "2020", 8, 0, 0)];
    const card = computePlayerRating(
      { id: "fringe-fb", name: "Fringe FB", position: "FB", seasonStats: stats },
      allTimeMode,
    );
    expect(card.ovr).toBeLessThan(64);
  });

  it("setHistoricalRatingsIndex loads lookup table", () => {
    setHistoricalRatingsIndex([
      { playerId: "miranda-test", peakOvr: 86, source: "legend_anchor" },
    ]);
    expect(getHistoricalRating("miranda-test")?.peakOvr).toBe(86);
  });
});
