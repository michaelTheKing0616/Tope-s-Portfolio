import { describe, expect, it } from "vitest";
import { attributesFromSeasonStats, ovrFromSeasonStats } from "./stats-rating.js";
import type { DraftModeConfig } from "@sportverse/draftballer-types";

const mode: DraftModeConfig = {
  id: "test",
  title: "Test",
  blurb: "",
  era: "all_time",
  competitionScope: "any_league",
  ratingLens: "club_only",
  blendFactor: 0,
};

describe("stats-rating", () => {
  it("prolific striker gets higher SHO than defensive stats", () => {
    const stats = [
      {
        playerId: "st",
        seasonLabel: "2020",
        competitionId: "premier-league",
        context: "CLUB" as const,
        appearances: 38,
        goals: 30,
        assists: 8,
        minutes: 3200,
        confidence: 0.9,
      },
    ];
    const result = attributesFromSeasonStats(stats, "ST", mode);
    expect(result).not.toBeNull();
    expect(result!.attrs.sho).toBeGreaterThanOrEqual(result!.attrs.def);
    expect(result!.attrs.sho).toBeGreaterThanOrEqual(65);
  });

  it("returns null when no stats after filter", () => {
    const stats = [
      {
        playerId: "x",
        seasonLabel: "2020",
        competitionId: "world-cup",
        context: "NATIONAL_TEAM" as const,
        appearances: 5,
        goals: 2,
        assists: 0,
        minutes: 450,
        confidence: 0.9,
      },
    ];
    const intlMode = { ...mode, ratingLens: "club_only" as const };
    expect(attributesFromSeasonStats(stats, "ST", intlMode)).toBeNull();
  });

  it("ovrFromSeasonStats returns OVR in valid range", () => {
    const stats = [
      {
        playerId: "cm",
        seasonLabel: "career",
        competitionId: "any",
        context: "CLUB" as const,
        appearances: 200,
        goals: 15,
        assists: 40,
        minutes: 15000,
        confidence: 0.8,
      },
    ];
    const r = ovrFromSeasonStats(stats, "CM", mode);
    expect(r).not.toBeNull();
    expect(r!.ovr).toBeGreaterThanOrEqual(1);
    expect(r!.ovr).toBeLessThanOrEqual(99);
  });
});
