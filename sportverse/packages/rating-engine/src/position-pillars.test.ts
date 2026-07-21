import { describe, expect, it } from "vitest";
import {
  minutesReliabilityFactor,
  positionMetricPercentile,
  shrinkPercentileTowardNeutral,
  valueToPercentile,
} from "./position-percentiles.js";
import {
  attrsFromPillarScores,
  ovrFromPillarScores,
  pillarScoresFromSubMetrics,
  POSITION_PILLAR_WEIGHTS,
} from "./position-pillars.js";

describe("position-percentiles", () => {
  it("maps values to monotonic percentiles", () => {
    const ref = { p10: 0.1, p25: 0.2, p50: 0.4, p75: 0.6, p90: 0.8 };
    expect(valueToPercentile(0.05, ref)).toBeLessThan(valueToPercentile(0.4, ref));
    expect(valueToPercentile(0.4, ref)).toBeCloseTo(50, 0);
    expect(valueToPercentile(0.9, ref)).toBeGreaterThan(90);
  });

  it("shrinks low-minute samples toward neutral", () => {
    expect(minutesReliabilityFactor(200, 5)).toBeLessThan(0.65);
    expect(minutesReliabilityFactor(2500, 30)).toBeGreaterThan(0.9);
    expect(shrinkPercentileTowardNeutral(90, 0.5)).toBeCloseTo(70, 0);
  });

  it("position-conditioned percentiles rank elite rates highly within each role", () => {
    const eliteSt = positionMetricPercentile("ST", "goals_per_90", 0.58);
    const avgSt = positionMetricPercentile("ST", "goals_per_90", 0.15);
    const eliteCb = positionMetricPercentile("CB", "goals_per_90", 0.08);
    const avgCb = positionMetricPercentile("CB", "goals_per_90", 0.02);
    expect(eliteSt).toBeGreaterThan(avgSt);
    expect(eliteCb).toBeGreaterThan(avgCb);
  });
});

describe("position-pillars", () => {
  it("pillar weights sum to ~1 for every role", () => {
    for (const pos of Object.keys(POSITION_PILLAR_WEIGHTS) as Array<keyof typeof POSITION_PILLAR_WEIGHTS>) {
      const sum = Object.values(POSITION_PILLAR_WEIGHTS[pos]).reduce((a, b) => a + (b ?? 0), 0);
      expect(sum).toBeGreaterThan(0.98);
      expect(sum).toBeLessThan(1.02);
    }
  });

  it("hybrid FB rewards defensive OR attacking excellence", () => {
    const defensive = {
      finishing: 40,
      chance_creation: 35,
      progression: 55,
      defending: 88,
      availability: 70,
      discipline: 60,
    };
    const attacking = {
      finishing: 55,
      chance_creation: 82,
      progression: 78,
      defending: 62,
      availability: 70,
      discipline: 60,
    };
    const defOvr = ovrFromPillarScores("FB", defensive, 2800, 32);
    const attOvr = ovrFromPillarScores("FB", attacking, 2800, 32);
    expect(defOvr).toBeGreaterThan(72);
    expect(attOvr).toBeGreaterThan(72);
  });

  it("prolific ST outscores CB on finishing pillar path", () => {
    const stSubs = {
      goals_per_90: 0.92,
      npxg_per_90: 0.88,
      assists_per_90: 0.75,
      minutes_per_app: 0.85,
      progressive_pass_proxy: 0.5,
      def_actions_proxy: 0.35,
    };
    const cbSubs = {
      goals_per_90: 0.2,
      npxg_per_90: 0.15,
      assists_per_90: 0.25,
      minutes_per_app: 0.9,
      defensive_value_proxy: 0.88,
      clean_sheet_proxy: 0.8,
    };
    const stPillars = pillarScoresFromSubMetrics("ST", stSubs);
    const cbPillars = pillarScoresFromSubMetrics("CB", cbSubs);
    expect(stPillars.finishing).toBeGreaterThan(cbPillars.finishing);
    expect(attrsFromPillarScores("ST", stPillars).sho).toBeGreaterThan(
      attrsFromPillarScores("CB", cbPillars).sho,
    );
  });
});
