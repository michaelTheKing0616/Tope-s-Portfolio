import { describe, expect, it, beforeEach } from "vitest";
import type { DraftModeConfig } from "@sportverse/draftballer-types";
import type { PlayerSeasonStat } from "@sportverse/sports-db";
import { computePlayerRating, mvOvrBlend, FABRICATED_OVR_CAP } from "./compute.js";
import {
  attachMvPercentilesFromPeakMv,
  setFameDataForRatings,
  mvPercentileForRating,
  fameScoreForRating,
} from "./fame-data.js";
import { setAwardsData } from "./awards.js";

const mode: DraftModeConfig = {
  id: "fame-firewall",
  title: "Firewall",
  blurb: "",
  era: "all_time",
  competitionScope: "any_league",
  ratingLens: "club_only",
  blendFactor: 0,
};

const sharedStats: PlayerSeasonStat[] = [
  {
    playerId: "fw-a",
    seasonLabel: "2020",
    competitionId: "premier-league",
    context: "CLUB",
    appearances: 36,
    goals: 18,
    assists: 6,
    minutes: 3000,
    confidence: 0.95,
  },
];

beforeEach(() => {
  setAwardsData([], []);
  setFameDataForRatings([]);
});

describe("fame firewall — fameScore never moves OVR", () => {
  it("identical stats + same mvPercentile → identical OVR when fameScore is 0 vs 99", () => {
    // Both share mvPercentile 60; only fameScore differs.
    setFameDataForRatings([
      { playerId: "fw-obscure", fameScore: 0, mvPercentile: 60 },
      { playerId: "fw-famous", fameScore: 99, mvPercentile: 60 },
    ]);

    const statsA = sharedStats.map((s) => ({ ...s, playerId: "fw-obscure" }));
    const statsB = sharedStats.map((s) => ({ ...s, playerId: "fw-famous" }));

    const a = computePlayerRating(
      { id: "fw-obscure", name: "Obscure", position: "ST", seasonStats: statsA },
      mode,
    );
    const b = computePlayerRating(
      { id: "fw-famous", name: "Famous", position: "ST", seasonStats: statsB },
      mode,
    );

    expect(fameScoreForRating("fw-obscure")).toBe(0);
    expect(fameScoreForRating("fw-famous")).toBe(99);
    expect(mvPercentileForRating("fw-obscure")).toBe(60);
    expect(mvPercentileForRating("fw-famous")).toBe(60);
    expect(a.ovr).toBe(b.ovr);
    expect(a.breakdown.mvBlend).toBe(b.breakdown.mvBlend);
    expect(a.breakdown.mvBlendDelta).toBe(b.breakdown.mvBlendDelta);
  });

  it("mvPercentileForRating never falls back to fameScore", () => {
    setFameDataForRatings([{ playerId: "fw-fame-only", fameScore: 95 }]);
    expect(mvPercentileForRating("fw-fame-only")).toBe(0);
  });

  it("attachMvPercentilesFromPeakMv ranks by peakMv within a cohort, ignoring fameScore", () => {
    const ranked = attachMvPercentilesFromPeakMv([
      { playerId: "low-mv-high-fame", fameScore: 99, peakMv: 1_000_000, peakMvYear: 2016 },
      { playerId: "high-mv-low-fame", fameScore: 10, peakMv: 100_000_000, peakMvYear: 2016 },
      { playerId: "mid", fameScore: 50, peakMv: 20_000_000, peakMvYear: 2017 },
    ]);
    const byId = new Map(ranked.map((e) => [e.playerId, e.mvPercentile ?? 0]));
    // Hand calc: same 2015 cohort (2015–2019), 3 players → 0 / 50 / 100
    expect(byId.get("low-mv-high-fame")).toBe(0);
    expect(byId.get("mid")).toBe(50);
    expect(byId.get("high-mv-low-fame")).toBe(100);
  });

  it("attachMvPercentilesFromPeakMv does not cross-rank across eras", () => {
    // €10M in 2005 is elite for that era; €10M in 2020 is ordinary — separate cohorts.
    const ranked = attachMvPercentilesFromPeakMv([
      { playerId: "era2005-mid", fameScore: 40, peakMv: 10_000_000, peakMvYear: 2005 },
      { playerId: "era2005-low", fameScore: 40, peakMv: 500_000, peakMvYear: 2006 },
      { playerId: "era2020-mid", fameScore: 40, peakMv: 10_000_000, peakMvYear: 2020 },
      { playerId: "era2020-high", fameScore: 40, peakMv: 80_000_000, peakMvYear: 2022 },
    ]);
    const byId = new Map(ranked.map((e) => [e.playerId, e.mvPercentile ?? 0]));
    // Hand calc: each 2-player cohort → 0 and 100
    expect(byId.get("era2005-low")).toBe(0);
    expect(byId.get("era2005-mid")).toBe(100);
    expect(byId.get("era2020-mid")).toBe(0);
    expect(byId.get("era2020-high")).toBe(100);
  });
});

describe("mvOvrBlend — hand-calculated", () => {
  it("base 80, pct 50 → weight 0.275, OVR 79, delta -1", () => {
    // mvOvr = round(55 + 50*0.44) = round(77) = 77
    // weight = 0.2 + 0.3*(0.5^2) = 0.275
    // blended = round(80*0.725 + 77*0.275) = round(58 + 21.175) = round(79.175) = 79
    setFameDataForRatings([{ playerId: "mv-calc", fameScore: 0, mvPercentile: 50 }]);
    const r = mvOvrBlend(80, "mv-calc", "ST");
    expect(r.percentile).toBe(50);
    expect(r.weight).toBeCloseTo(0.275, 5);
    expect(r.ovr).toBe(79);
    expect(r.delta).toBe(-1);
  });

  it("era-top MV percentile carries max weight — pulls a stats-blind 60 toward elite", () => {
    // weight = min(0.5, 0.2 + 0.3*1) = 0.5; mvOvr = round(55 + 44) = 99
    // blended = round(60*0.5 + 99*0.5) = round(79.5) = 80
    setFameDataForRatings([{ playerId: "mv-top", fameScore: 0, mvPercentile: 100 }]);
    const r = mvOvrBlend(60, "mv-top", "FB");
    expect(r.weight).toBe(0.5);
    expect(r.ovr).toBe(80);
  });
});

describe("fabricated cap constant", () => {
  it("exposes the audit-panel cap of 72", () => {
    expect(FABRICATED_OVR_CAP).toBe(72);
  });
});
