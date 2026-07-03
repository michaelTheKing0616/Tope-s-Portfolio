import { describe, expect, it, beforeAll } from "vitest";
import type { DraftModeConfig } from "@sportverse/draftballer-types";
import type { PlayerSeasonStat } from "@sportverse/sports-db";
import { __setExtendedDataForTests } from "@sportverse/sports-db";
import { lensBlend } from "./lens-blend.js";
import { peakWeightStats } from "./peak-weighting.js";
import { setAwardsData, awardBonus, bigMomentBonus, longevityAdjustment } from "./awards.js";
import { computePlayerRating } from "./compute.js";
import { ovrFromAttributes } from "./position-weights.js";
import { attributesFromSeasonStats, ovrFromSeasonStats } from "./stats-rating.js";

/** Bible §14.1 worked example — hand-checked deterministic fixture. */
const WORKED_PLAYER_ID = "worked-striker";
const clubStats: PlayerSeasonStat[] = [
  {
    playerId: WORKED_PLAYER_ID,
    seasonLabel: "2020",
    competitionId: "premier-league",
    context: "CLUB",
    appearances: 38,
    goals: 30,
    assists: 8,
    minutes: 3200,
    confidence: 0.95,
  },
];
const intlStats: PlayerSeasonStat[] = [
  {
    playerId: WORKED_PLAYER_ID,
    seasonLabel: "2018",
    competitionId: "world-cup",
    context: "NATIONAL_TEAM",
    appearances: 7,
    goals: 6,
    assists: 2,
    minutes: 630,
    confidence: 0.92,
  },
];
const allStats = [...clubStats, ...intlStats];

const allTimeClubMode: DraftModeConfig = {
  id: "test-club",
  title: "Test",
  blurb: "",
  era: "all_time",
  competitionScope: "any_league",
  ratingLens: "club_only",
  blendFactor: 0,
};

beforeAll(() => {
  __setExtendedDataForTests({
    players: [],
    stats: allStats,
    eras: [
      {
        competitionId: "premier-league",
        seasonLabel: "2020",
        stat: "goals_per_game",
        mean: 2.7,
        stdev: 0.8,
      },
    ],
  });
  setAwardsData(
    [{ playerId: WORKED_PLAYER_ID, award: "Golden Boot", year: 2020, context: "club", bonus: 2 }],
    [{ playerId: WORKED_PLAYER_ID, moment: "Title-clinching hat-trick", context: "club", bonus: 2 }],
  );
});

describe("rating v3 — bible §14.1 worked example", () => {
  it("era normalization: identical z-scores yield identical SHO for same position", () => {
    const a = attributesFromSeasonStats(clubStats, "ST", allTimeClubMode);
    const b = attributesFromSeasonStats(
      clubStats.map((s) => ({ ...s, seasonLabel: "2021" })),
      "ST",
      allTimeClubMode,
    );
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a!.attrs.sho).toBe(b!.attrs.sho);
  });

  it("peak weighting keeps top seasons only for all-time", () => {
    const many: PlayerSeasonStat[] = [
      ...clubStats,
      {
        playerId: WORKED_PLAYER_ID,
        seasonLabel: "2015",
        competitionId: "premier-league",
        context: "CLUB",
        appearances: 10,
        goals: 1,
        assists: 0,
        minutes: 400,
        confidence: 0.8,
      },
      {
        playerId: WORKED_PLAYER_ID,
        seasonLabel: "2016",
        competitionId: "premier-league",
        context: "CLUB",
        appearances: 12,
        goals: 2,
        assists: 1,
        minutes: 500,
        confidence: 0.8,
      },
      {
        playerId: WORKED_PLAYER_ID,
        seasonLabel: "2017",
        competitionId: "premier-league",
        context: "CLUB",
        appearances: 15,
        goals: 5,
        assists: 2,
        minutes: 900,
        confidence: 0.85,
      },
      {
        playerId: WORKED_PLAYER_ID,
        seasonLabel: "2019",
        competitionId: "premier-league",
        context: "CLUB",
        appearances: 20,
        goals: 12,
        assists: 4,
        minutes: 1600,
        confidence: 0.9,
      },
    ];
    const peak = peakWeightStats(many, 4);
    expect(peak.length).toBe(4);
    expect(peak.some((s) => s.seasonLabel === "2020")).toBe(true);
    expect(peak.some((s) => s.seasonLabel === "2015")).toBe(false);
  });

  it("lens blend at b=0, b=1, b=0.35 matches hand calculation", () => {
    const clubOvr = 88;
    const intlOvr = 82;
    expect(lensBlend(clubOvr, intlOvr, "club_only", 0)).toBe(88);
    expect(lensBlend(clubOvr, intlOvr, "international_only", 1)).toBe(82);
    const blended = lensBlend(clubOvr, intlOvr, "blended", 0.35);
    const expected = Math.round((1 - 0.35) * 88 + 0.35 * 82 + Math.max(0, 3 - Math.abs(88 - 82) / 5));
    expect(blended).toBe(Math.max(1, Math.min(99, expected)));
  });

  it("award bonus filtered by lens", () => {
    setAwardsData(
      [
        { playerId: "x", award: "Ballon d'Or", year: 2020, context: "club", bonus: 3 },
        { playerId: "x", award: "World Cup", year: 2018, context: "international", bonus: 3 },
      ],
      [],
    );
    expect(awardBonus("x", "club_only")).toBe(3);
    expect(awardBonus("x", "international_only")).toBe(3);
    expect(awardBonus("x", "blended")).toBe(6);
  });

  it("full pipeline produces stable OVR for worked striker", () => {
    setAwardsData(
      [{ playerId: WORKED_PLAYER_ID, award: "Golden Boot", year: 2020, context: "club", bonus: 2 }],
      [{ playerId: WORKED_PLAYER_ID, moment: "Title-clinching hat-trick", context: "club", bonus: 2 }],
    );
    const clubAttrs = attributesFromSeasonStats(clubStats, "ST", allTimeClubMode)!;
    const clubFromPipeline = ovrFromSeasonStats(clubStats, "ST", allTimeClubMode)!;

    const intlMode: DraftModeConfig = {
      ...allTimeClubMode,
      ratingLens: "international_only",
      competitionScope: "international",
    };
    const intlFromPipeline = ovrFromSeasonStats(intlStats, "ST", intlMode)!;

    const blendedMode: DraftModeConfig = {
      ...allTimeClubMode,
      ratingLens: "blended",
      blendFactor: 0.35,
    };
    const card = computePlayerRating(
      {
        id: WORKED_PLAYER_ID,
        name: "Worked Striker",
        position: "Forward",
        seasonStats: allStats,
      },
      blendedMode,
    );

    expect(card.breakdown.clubOvrRaw).toBeGreaterThanOrEqual(clubFromPipeline.ovr - 2);
    expect(card.breakdown.intlOvrRaw).toBeGreaterThanOrEqual(intlFromPipeline.ovr - 2);
    expect(card.breakdown.awardBonus).toBeGreaterThanOrEqual(4);
    expect(card.ovr).toBeGreaterThanOrEqual(58);
    expect(card.ovr).toBeLessThanOrEqual(99);
    expect(bigMomentBonus(WORKED_PLAYER_ID, "blended")).toBe(2);
    expect(longevityAdjustment(allStats, "all_time")).toBeGreaterThanOrEqual(0);

    const clubOnly = computePlayerRating(
      { id: WORKED_PLAYER_ID, name: "Worked Striker", position: "Forward", seasonStats: allStats },
      allTimeClubMode,
    );
    expect(clubOnly.attributes.sho).toBeGreaterThanOrEqual(65);
    expect(clubOnly.ovr).toBeGreaterThanOrEqual(60);
  });
});
