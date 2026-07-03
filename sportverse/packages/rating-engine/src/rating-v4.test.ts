import { describe, expect, it } from "vitest";
import { computeSquadRating } from "./squad-rating.js";
import { communityCalibrationNudge, setCalibrationDataForTests } from "./calibration.js";
import { macroFromSubMetrics } from "./micro-coefficients.js";
import { extractSubMetrics } from "./sub-metrics.js";
import { NO_POPULARITY_BONUS_RULE } from "./constants.js";
import type { RatedPlayerCard } from "@sportverse/draftballer-types";

function mockCard(ovr: number, id = "p"): RatedPlayerCard {
  return {
    playerId: id,
    name: id,
    nationality: "Brazil",
    position: "ST",
    ovr,
    tier: "gold",
    attributes: { pac: 80, sho: ovr, pas: 70, dri: 75, def: 40, phy: 75 },
    confidence: 0.9,
    breakdown: { clubOvrRaw: ovr, intlOvrRaw: ovr, awardBonus: 0, lens: "club_only", blendFactor: 0 },
  };
}

describe("rating engine v4 — EA addendum", () => {
  it("squad CF rewards standout talent above flat average", () => {
    const squad = [mockCard(92, "a"), ...Array.from({ length: 10 }, (_, i) => mockCard(74, `b${i}`))];
    const rated = computeSquadRating(squad);
    expect(rated.squadRating).toBeGreaterThan(rated.flatAverage);
    expect(rated.correctionFactor).toBeGreaterThan(0);
  });

  it("micro layer applies floor weights", () => {
    const sub = extractSubMetrics(
      [
        {
          playerId: "x",
          seasonLabel: "2020",
          competitionId: "pl",
          context: "CLUB",
          appearances: 30,
          goals: 20,
          assists: 5,
          minutes: 2500,
          confidence: 0.9,
        },
      ],
      "ST",
      {
        id: "t",
        title: "t",
        blurb: "",
        era: "all_time",
        competitionScope: "any_league",
        ratingLens: "club_only",
        blendFactor: 0,
      },
    );
    const { attrs } = macroFromSubMetrics("ST", sub);
    expect(attrs.sho).toBeGreaterThan(50);
  });

  it("calibration only applies when confidence is low", () => {
    setCalibrationDataForTests([
      {
        playerId: "low",
        nudge: 2,
        reason: "test",
        evidenceRef: "ref",
        reviewerId: "r",
        at: "2026-01-01",
      },
    ]);
    expect(communityCalibrationNudge("low", 0.6).nudge).toBe(2);
    expect(communityCalibrationNudge("low", 0.95).nudge).toBe(0);
  });

  it("codifies no popularity bonus rule", () => {
    expect(NO_POPULARITY_BONUS_RULE).toMatch(/fame|marketability/i);
  });
});
