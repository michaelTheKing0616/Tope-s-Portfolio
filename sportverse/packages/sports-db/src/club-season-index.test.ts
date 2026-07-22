import { describe, expect, it } from "vitest";
import type { DraftModeConfig } from "@sportverse/draftballer-types";
import {
  isRecognizableWheelClub,
  listSimChallengers,
  listSpinnableClubSeasons,
  looksLikeJunkClubAlias,
  parseSeasonStartYear,
  SIM_MIN_CLUBS,
  WHEEL_RECOGNIZED_LEAGUE_IDS,
} from "./club-season-index.js";

const allTime: DraftModeConfig = {
  id: "all-time-any",
  title: "All-Time",
  blurb: "",
  era: "all_time",
  competitionScope: "any_league",
  ratingLens: "club_only",
  blendFactor: 0,
};

describe("club-season-index — wheel quality", () => {
  it("parses YY/YY season labels into real start years", () => {
    expect(parseSeasonStartYear("09/10")).toBe(2009);
    expect(parseSeasonStartYear("00/01")).toBe(2000);
    expect(parseSeasonStartYear("99/00")).toBe(1999);
    expect(parseSeasonStartYear("15/16")).toBe(2015);
    expect(parseSeasonStartYear("2005")).toBe(2005);
    expect(parseSeasonStartYear("2005/06")).toBe(2005);
  });

  it("flags TM junk aliases like ZB Home", () => {
    expect(looksLikeJunkClubAlias("ZB Home")).toBe(true);
    expect(looksLikeJunkClubAlias("ZB Cuju")).toBe(true);
    expect(looksLikeJunkClubAlias("Manchester United")).toBe(false);
    expect(isRecognizableWheelClub("ZB Home")).toBe(false);
  });

  it("only lists recognizable-league club-seasons", () => {
    const list = listSpinnableClubSeasons(allTime);
    if (!list.length) return;
    for (const entry of list) {
      expect(looksLikeJunkClubAlias(entry.clubName)).toBe(false);
      expect(isRecognizableWheelClub(entry.clubName, entry.clubId)).toBe(true);
      expect(WHEEL_RECOGNIZED_LEAGUE_IDS.size).toBeGreaterThan(10);
    }
    expect(list.some((e) => /ZB\s/i.test(e.clubName))).toBe(false);
  });

  it("decade 2000s includes YY/YY seasons (not only calendar YYYY)", () => {
    const mode: DraftModeConfig = {
      ...allTime,
      era: "decade",
      decade: "2000s",
    };
    const list = listSpinnableClubSeasons(mode);
    if (!list.length) return;
    const yyYy = list.filter((e) => /^\d{2}\/\d{2}$/.test(e.seasonLabel));
    expect(yyYy.length).toBeGreaterThan(0);
    expect(list.every((e) => isRecognizableWheelClub(e.clubName, e.clubId))).toBe(true);
  });

  it("listSimChallengers enumerates league×season combos without hard-coded leagues", () => {
    const catalog = listSimChallengers();
    if (!catalog.length) return;
    expect(SIM_MIN_CLUBS).toBeGreaterThanOrEqual(10);
    for (const row of catalog) {
      expect(row.leagueId.length).toBeGreaterThan(0);
      expect(row.clubCount).toBeGreaterThan(0);
      expect(row.ready).toBe(row.clubCount >= SIM_MIN_CLUBS);
    }
  });
});
