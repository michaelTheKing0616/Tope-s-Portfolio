import type { DraftModeConfig } from "@sportverse/draftballer-types";
import type { ExtendedPlayer } from "@sportverse/sports-db";
import type { RatingInput } from "@sportverse/rating-engine";
import { getClubsExtended, getDraftPlayers, getSeasonStats, resolveCompetitionToLeague } from "@sportverse/sports-db";
import { isContinentalCompetition } from "./competition-ids.js";
import { peakWeightStats } from "@sportverse/rating-engine";

export interface EligibilityFilter {
  minAppearances?: number;
  nationality?: string;
  legendsOnly?: boolean;
}

function seasonToDecade(seasonLabel: string): string {
  const y = Number(seasonLabel);
  if (!y || y < 2000) return "1990s";
  if (y < 2010) return "2000s";
  if (y < 2020) return "2010s";
  return "2020s";
}

function toRatingInput(p: ExtendedPlayer): RatingInput {
  return {
    id: p.id,
    name: p.name,
    nationality: p.nationality,
    position: p.position,
    clubs: p.clubs,
    seasonStats: getSeasonStats(p.id),
  };
}

function premierLeagueClubNames(): Set<string> {
  return new Set(getClubsExtended().filter((c) => c.league === "premier-league").map((c) => c.name));
}

const LEGEND_IDS = new Set([
  "messi",
  "ronaldo",
  "pele",
  "maradona",
  "zidane",
  "maldini",
  "ronaldinho",
  "henry",
  "modric",
  "benzema",
]);

/** Single filter engine for all draft modes (bible §3). */
export function buildFilteredPoolInputs(
  mode: DraftModeConfig,
  eligibility: EligibilityFilter = {},
): RatingInput[] {
  let players = getDraftPlayers().map(toRatingInput);

  if (mode.competitionScope === "single_league" && mode.leagueId) {
    if (mode.leagueId === "premier-league") {
      const plClubs = premierLeagueClubNames();
      players = players.filter((p) => p.clubs?.some((c) => plClubs.has(c)));
    } else {
      players = players.filter((p) =>
        getSeasonStats(p.id).some((s) => s.competitionId === mode.leagueId && s.context === "CLUB"),
      );
    }
  }

  if (mode.competitionScope === "continental") {
    players = players.filter((p) =>
      getSeasonStats(p.id).some(
        (s) => s.context === "CLUB" && isContinentalCompetition(s.competitionId),
      ),
    );
  }

  if (mode.competitionScope === "international") {
    players = players.filter((p) =>
      getSeasonStats(p.id).some((s) => s.context === "NATIONAL_TEAM"),
    );
  }

  if (mode.era === "decade" && mode.decade) {
    const decade = mode.decade;
    players = players.filter((p) => {
      const ext = getDraftPlayers().find((x) => x.id === p.id);
      if (ext?.decades?.includes(decade)) return true;
      return getSeasonStats(p.id).some((s) => seasonToDecade(s.seasonLabel) === decade);
    });
  }

  if (mode.era === "single_year" && mode.year) {
    const year = String(mode.year);
    players = players.filter((p) => getSeasonStats(p.id).some((s) => s.seasonLabel === year));
  }

  if (mode.era === "custom_range" && mode.yearFrom != null && mode.yearTo != null) {
    const from = mode.yearFrom;
    const to = mode.yearTo;
    players = players.filter((p) =>
      getSeasonStats(p.id).some((s) => {
        const y = Number(s.seasonLabel);
        return Number.isFinite(y) && y >= from && y <= to;
      }),
    );
  }

  if (mode.competitionScope === "custom" && mode.leagueIds?.length) {
    const leagues = new Set(mode.leagueIds);
    players = players.filter((p) =>
      getSeasonStats(p.id).some((s) => {
        if (s.context !== "CLUB") return false;
        const league = resolveCompetitionToLeague(s.competitionId) ?? s.competitionId;
        return leagues.has(league) || leagues.has(s.competitionId);
      }),
    );
  }

  if (mode.primeYearsOnly) {
    players = players.map((p) => {
      const stats = getSeasonStats(p.id);
      const peak = peakWeightStats(stats, 4);
      return { ...p, seasonStats: peak.length ? peak : stats };
    });
  }

  if (eligibility.nationality) {
    const nat = eligibility.nationality.toLowerCase();
    players = players.filter((p) => p.nationality?.toLowerCase().includes(nat));
  }

  if (eligibility.legendsOnly) {
    players = players.filter((p) => LEGEND_IDS.has(p.id));
  }

  const minApps = eligibility.minAppearances ?? 0;
  if (minApps > 0) {
    players = players.filter((p) => {
      const apps = getSeasonStats(p.id).reduce((s, r) => s + r.appearances, 0);
      return apps >= minApps;
    });
  }

  return players;
}
