import { describe, expect, it } from "vitest";
import { getPresetMode, ratePlayerById } from "@sportverse/draftballer-core";
import { listSimChallengers, listSimClubSeasons } from "@sportverse/sports-db";
import { generateHistoricalOpponents } from "./opponent.js";

describe("historical league challengers", () => {
  it("listSimChallengers returns catalog entries when archive data is loaded", () => {
    const catalog = listSimChallengers();
    if (!catalog.length) return;

    expect(catalog[0]).toMatchObject({
      leagueId: expect.any(String),
      leagueName: expect.any(String),
      seasonLabel: expect.any(String),
      clubCount: expect.any(Number),
      ready: expect.any(Boolean),
    });
    expect(catalog.some((c) => c.ready)).toBe(true);
  });

  it("listSimClubSeasons returns squads without wheel fame gate", () => {
    const ready = listSimChallengers().find((c) => c.ready);
    if (!ready) return;

    const clubs = listSimClubSeasons(ready.leagueId, ready.seasonLabel);
    expect(clubs.length).toBeGreaterThanOrEqual(ready.clubCount);
    for (const club of clubs) {
      expect(club.playerIds.length).toBeGreaterThanOrEqual(11);
    }
  });

  it("generateHistoricalOpponents uses real club names, not Surname XI", () => {
    const ready = listSimChallengers().find((c) => c.ready);
    if (!ready) return;

    const mode = getPresetMode("all-time-any");
    const opponents = generateHistoricalOpponents({
      leagueId: ready.leagueId,
      seasonLabel: ready.seasonLabel,
      matchCount: 6,
      seed: "hist-test",
      ratePlayer: (id) => ratePlayerById(id, mode),
    });
    if (!opponents.length) return;

    for (const opp of opponents) {
      expect(opp.name).not.toMatch(/XI \(\d+ OVR\)/);
      expect(opp.name).toContain(ready.seasonLabel);
      expect(opp.players.length).toBe(11);
      expect(opp.squadOvr).toBeGreaterThan(0);
    }
  });
});
