/**
 * Archive → calibration datasets for LSI v2, aggregation bridge, and bridging bounds.
 * Uses Transfermarkt archive CSVs (sportverse/archive/).
 */
import { resolve } from "node:path";
import {
  ARCHIVE_DIR,
  readCsv,
  streamCsv,
} from "./utils.mjs";
import {
  mapCompetition,
  isContinentalCompetition,
  seasonNameToYear,
} from "./competition-map.mjs";

const PATHS = {
  performances: resolve(ARCHIVE_DIR, "player_performances/player_performances.csv"),
  transfers: resolve(ARCHIVE_DIR, "transfer_history/transfer_history.csv"),
  teamDetails: resolve(ARCHIVE_DIR, "team_details/team_details.csv"),
  teamSeasons: resolve(ARCHIVE_DIR, "team_competitions_seasons/team_competitions_seasons.csv"),
  profiles: resolve(ARCHIVE_DIR, "player_profiles/player_profiles.csv"),
};

const DOMESTIC_TYPES = new Set(["domestic_league"]);

/** team_id → domestic league id for a given season label (e.g. "20/21"). */
function buildTeamLeagueIndex() {
  const teamSeasonLeague = new Map();
  for (const row of readCsv(PATHS.teamSeasons)) {
    if (!row.club_id || !row.competition_id) continue;
    const mapped = mapCompetition(row.competition_id, row.competition_name);
    if (mapped.type !== "domestic_league") continue;
    const key = `${row.club_id}|${row.season_id}`;
    teamSeasonLeague.set(key, mapped.id);
    teamSeasonLeague.set(`${row.club_id}|${row.season_name}`, mapped.id);
  }
  for (const row of readCsv(PATHS.teamDetails)) {
    if (!row.club_id || !row.competition_id || !row.season_id) continue;
    const mapped = mapCompetition(row.competition_id, row.competition_name);
    if (mapped.type !== "domestic_league") continue;
    teamSeasonLeague.set(`${row.club_id}|${row.season_id}`, mapped.id);
  }
  return teamSeasonLeague;
}

function leagueForTeam(teamId, seasonLabel, teamLeagueIndex) {
  const y = seasonNameToYear(seasonLabel);
  if (y != null) {
    const byYear = teamLeagueIndex.get(`${teamId}|${y}`);
    if (byYear) return byYear;
  }
  return teamLeagueIndex.get(`${teamId}|${seasonLabel}`) ?? null;
}

function performanceZ(goals, assists, apps) {
  if (apps < 5) return 0;
  const gpg = (goals + assists * 0.6) / apps;
  return (gpg - 0.15) / 0.12;
}

/**
 * @param {Map<string, { goals: number, assists: number, apps: number }>} perfByPlayerSeason
 */
export async function buildPlayerTransfers(perfByPlayerSeason, teamLeagueIndex, limit = 8000) {
  const transfers = [];
  const birthYear = new Map();
  for (const row of readCsv(PATHS.profiles)) {
    if (row.player_id && row.date_of_birth) {
      birthYear.set(row.player_id, Number(row.date_of_birth.slice(0, 4)));
    }
  }

  await streamCsv(PATHS.transfers, async (row) => {
    if (transfers.length >= limit) return;
    const fromLeague = leagueForTeam(row.from_team_id, row.season_name, teamLeagueIndex);
    const toLeague = leagueForTeam(row.to_team_id, row.season_name, teamLeagueIndex);
    if (!fromLeague || !toLeague || fromLeague === toLeague) return;
    if (row.to_team_name === "Retired" || row.from_team_name === "Without Club") return;

    const season = row.season_name;
    const y = seasonNameToYear(season);
    const preKey = `${row.player_id}|${season}`;
    const pre = perfByPlayerSeason.get(preKey);
    const postSeason = y != null ? `${String(y).slice(-2)}/${String(y + 1).slice(-2)}` : season;
    const post = perfByPlayerSeason.get(`${row.player_id}|${postSeason}`);

    const preMoveZ = pre ? performanceZ(pre.goals, pre.assists, pre.apps) : 0;
    const postMoveZ = post ? performanceZ(post.goals, post.assists, post.apps) : preMoveZ * 0.85;

    const by = birthYear.get(row.player_id);
    const ageAtTransfer = by && y ? y - by : 25;

    transfers.push({
      playerId: `tm-${row.player_id}`,
      fromLeagueId: fromLeague,
      toLeagueId: toLeague,
      transferSeason: String(y ?? seasonNameToYear(season) ?? "2020"),
      preMoveZ,
      postMoveZ,
      ageAtTransfer,
      minutesPre: (pre?.apps ?? 0) * 75,
      minutesPost: (post?.apps ?? 0) * 75,
      roleChangeFlag: false,
    });
  });

  return transfers;
}

/** Continental comp league-vs-league comparison fixtures for LSI Elo (§1.2). */
export async function buildCrossLeagueFixtures(teamLeagueIndex, limit = 500) {
  /** season|comp -> league -> { goals, apps } */
  const buckets = new Map();

  await streamCsv(PATHS.performances, async (row) => {
    const mapped = mapCompetition(row.competition_id, row.competition_name);
    if (!isContinentalCompetition(mapped.id)) return;
    const league = leagueForTeam(row.team_id, row.season_name, teamLeagueIndex);
    if (!league) return;
    const apps = Number(row.nb_on_pitch) || 0;
    if (apps < 3) return;
    const key = `${row.season_name}|${mapped.id}`;
    const leagueMap = buckets.get(key) ?? new Map();
    const cur = leagueMap.get(league) ?? { goals: 0, apps: 0 };
    cur.goals += Number(row.goals) || 0;
    cur.apps += apps;
    leagueMap.set(league, cur);
    buckets.set(key, leagueMap);
  });

  const fixtures = [];
  for (const [key, leagueMap] of buckets) {
    const [seasonLabel, competitionId] = key.split("|");
    const leagues = [...leagueMap.entries()].filter(([, v]) => v.apps >= 30);
    for (let i = 0; i < leagues.length; i++) {
      for (let j = i + 1; j < leagues.length; j++) {
        if (fixtures.length >= limit) break;
        const [leagueAId, a] = leagues[i];
        const [leagueBId, b] = leagues[j];
        const gpgA = a.goals / a.apps;
        const gpgB = b.goals / b.apps;
        const margin = gpgA - gpgB;
        let result = 0;
        if (margin > 0.04) result = 1;
        else if (margin < -0.04) result = -1;
        fixtures.push({
          fixtureId: `arch-${seasonLabel}-${competitionId}-${leagueAId}-${leagueBId}`,
          clubAId: `${leagueAId}-rep`,
          leagueAId,
          clubBId: `${leagueBId}-rep`,
          leagueBId,
          competitionId,
          seasonLabel: String(seasonNameToYear(seasonLabel) ?? seasonLabel),
          result,
        });
      }
    }
  }
  return fixtures;
}

/** Team-season goals for/against in domestic leagues — feeds aggregation bridge §3.2. */
export async function buildTeamSeasonRecords(teamLeagueIndex, limit = 12000) {
  /** teamId|season|league -> { gf, ga, apps } */
  const agg = new Map();

  await streamCsv(PATHS.performances, async (row) => {
    const mapped = mapCompetition(row.competition_id, row.competition_name);
    if (mapped.type !== "domestic_league") return;
    const league = leagueForTeam(row.team_id, row.season_name, teamLeagueIndex) ?? mapped.id;
    const apps = Number(row.nb_on_pitch) || 0;
    if (apps < 1) return;
    const key = `${row.team_id}|${row.season_name}|${league}`;
    const cur = agg.get(key) ?? { teamId: row.team_id, seasonLabel: row.season_name, leagueId: league, goalsFor: 0, goalsAgainst: 0, apps: 0 };
    cur.goalsFor += Number(row.goals) || 0;
    cur.goalsAgainst += Number(row.goals_conceded) || 0;
    cur.apps += apps;
    agg.set(key, cur);
  });

  const records = [...agg.values()]
    .filter((r) => r.apps >= 80)
    .slice(0, limit)
    .map((r) => ({
      teamId: r.teamId,
      seasonLabel: r.seasonLabel,
      leagueId: r.leagueId,
      goalsFor: r.goalsFor,
      goalsAgainst: r.goalsAgainst,
      matchesProxy: Math.round(r.apps / 14),
    }));
  return records;
}

/** Lightweight player-season perf index for transfer z-scores. */
export async function buildPlayerSeasonPerfIndex(limit = 400000) {
  const map = new Map();
  let n = 0;
  await streamCsv(PATHS.performances, async (row) => {
    if (n >= limit) return;
    const mapped = mapCompetition(row.competition_id, row.competition_name);
    if (mapped.type !== "domestic_league") return;
    const apps = Number(row.nb_on_pitch) || 0;
    if (apps < 1) return;
    const key = `${row.player_id}|${row.season_name}`;
    const cur = map.get(key) ?? { goals: 0, assists: 0, apps: 0 };
    cur.goals += Number(row.goals) || 0;
    cur.assists += Number(row.assists) || 0;
    cur.apps += apps;
    map.set(key, cur);
    n++;
  });
  return map;
}

export async function buildAllCalibrationData() {
  console.log("  Building calibration datasets from archive…");
  const teamLeagueIndex = buildTeamLeagueIndex();
  const perfIndex = await buildPlayerSeasonPerfIndex();
  const [transfers, fixtures, teamSeasonRecords] = await Promise.all([
    buildPlayerTransfers(perfIndex, teamLeagueIndex),
    buildCrossLeagueFixtures(teamLeagueIndex),
    buildTeamSeasonRecords(teamLeagueIndex),
  ]);
  return { transfers, fixtures, teamSeasonRecords, meta: { transfers: transfers.length, fixtures: fixtures.length, teamSeasonRecords: teamSeasonRecords.length } };
}
