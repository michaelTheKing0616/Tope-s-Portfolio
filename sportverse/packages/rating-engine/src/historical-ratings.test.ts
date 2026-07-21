import { describe, expect, it } from "vitest";
import {
  blendWithHistoricalCalibration,
  peakMvToTier2Ovr,
  setHistoricalRatingsIndex,
  getHistoricalRating,
} from "./historical-ratings.js";

describe("historical-ratings", () => {
  it("peakMvToTier2Ovr maps era MV share to sensible prime floors", () => {
    expect(peakMvToTier2Ovr(0)).toBe(0);
    expect(peakMvToTier2Ovr(7)).toBe(0);
    expect(peakMvToTier2Ovr(8)).toBeGreaterThanOrEqual(62);
    expect(peakMvToTier2Ovr(25)).toBeGreaterThanOrEqual(68);
    expect(peakMvToTier2Ovr(50)).toBeGreaterThanOrEqual(75);
    expect(peakMvToTier2Ovr(90)).toBeLessThanOrEqual(91);
  });

  it("blendWithHistoricalCalibration floors weak stats at historical peak", () => {
    const entry = { playerId: "tm-test", peakOvr: 84, source: "peak_mv_tier2" as const };
    const low = blendWithHistoricalCalibration(62, entry);
    expect(low.ovr).toBeGreaterThanOrEqual(84);
    expect(low.uplift).toBeGreaterThan(0);

    const high = blendWithHistoricalCalibration(88, entry);
    expect(high.ovr).toBeGreaterThanOrEqual(88);
  });

  it("setHistoricalRatingsIndex loads lookup table", () => {
    setHistoricalRatingsIndex([
      { playerId: "miranda-test", peakOvr: 86, source: "legend_anchor" },
    ]);
    expect(getHistoricalRating("miranda-test")?.peakOvr).toBe(86);
  });
});
