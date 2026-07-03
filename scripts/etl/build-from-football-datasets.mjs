import { readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { readCsv, slugify, normalizeName, mapPosition, RAW_DIR } from "./utils.mjs";

const FD = resolve(RAW_DIR, "football-datasets/datasets");
const LEAGUES = [
  { id: "premier-league", name: "Premier League", country: "England" },
  { id: "la-liga", name: "La Liga", country: "Spain" },
  { id: "serie-a", name: "Serie A", country: "Italy" },
  { id: "bundesliga", name: "Bundesliga", country: "Germany" },
  { id: "ligue-1", name: "Ligue 1", country: "France" },
];

function decadeFromYear(year) {
  const y = Number(year);
  if (!y || y < 1990) return "1990s";
  if (y < 2000) return "1990s";
  if (y < 2010) return "2000s";
  if (y < 2020) return "2010s";
  return "2020s";
}

export function buildFromFootballDatasets(curatedPlayers) {
  const curatedByNorm = new Map(curatedPlayers.map((p) => [normalizeName(p.name), p]));

  const competitions = [
    ...LEAGUES.map((l) => ({
      id: l.id,
      name: l.name,
      type: "domestic_league",
      country: l.country,
    })),
    { id: "world-cup", name: "FIFA World Cup", type: "international_tournament", country: "International" },
  ];

  const clubsExtended = [];
  const teamSet = new Set();
  const clubsByLeague = new Map(LEAGUES.map((l) => [l.id, new Set()]));

  for (const league of LEAGUES) {
    const dir = resolve(FD, league.id);
    if (!existsSync(dir)) continue;
    const seasons = readdirSync(dir).filter((f) => f.startsWith("season-") && f.endsWith(".csv"));
    for (const file of seasons) {
      const rows = readCsv(resolve(dir, file));
      for (const row of rows) {
        for (const team of [row.HomeTeam, row.AwayTeam]) {
          if (!team || teamSet.has(`${league.id}:${team}`)) continue;
          teamSet.add(`${league.id}:${team}`);
          clubsByLeague.get(league.id)?.add(team);
          clubsExtended.push({
            id: slugify(`${league.id}-${team}`),
            name: team,
            league: league.id,
            country: league.country,
          });
        }
      }
    }
  }

  const wcDir = resolve(FD, "worldcup");
  const playersCsv = readCsv(resolve(wcDir, "players.csv"));
  const squads = readCsv(resolve(wcDir, "squads.csv"));
  const appearances = readCsv(resolve(wcDir, "player_appearances.csv"));
  const goalsCsv = readCsv(resolve(wcDir, "goals.csv"));

  const wcPlayerMap = new Map();
  for (const p of playersCsv) {
    if (p.female === "1") continue;
    const fullName = `${p.given_name} ${p.family_name}`.trim();
    wcPlayerMap.set(p.player_id, {
      wcId: p.player_id,
      name: fullName,
      norm: normalizeName(fullName),
      birthDate: p.birth_date,
      position: mapPosition("", {
        goal_keeper: p.goal_keeper,
        defender: p.defender,
        midfielder: p.midfielder,
        forward: p.forward,
      }),
      tournaments: p.list_tournaments,
    });
  }

  const squadMeta = new Map();
  for (const row of squads) {
    const pid = row.player_id;
    const year = (row.tournament_name?.match(/\d{4}/) ?? ["0000"])[0];
    const meta = squadMeta.get(pid) ?? {
      nationality: row.team_name,
      teamCode: row.team_code,
      decades: new Set(),
      tournaments: new Set(),
    };
    meta.decades.add(decadeFromYear(year));
    meta.tournaments.add(row.tournament_name);
    squadMeta.set(pid, meta);
  }

  const statsByPlayer = new Map();
  for (const row of appearances) {
    const pid = row.player_id;
    const year = (row.tournament_name?.match(/\d{4}/) ?? ["0000"])[0];
    const key = `${pid}:${year}`;
    const cur = statsByPlayer.get(key) ?? {
      playerId: pid,
      seasonLabel: year,
      competitionId: "world-cup",
      context: "NATIONAL_TEAM",
      appearances: 0,
      goals: 0,
      assists: 0,
      minutes: 0,
      teamName: row.team_name,
    };
    cur.appearances += 1;
    cur.minutes += row.starter === "1" ? 90 : 30;
    statsByPlayer.set(key, cur);

    const sm = squadMeta.get(pid);
    if (sm && row.team_name) sm.nationality = row.team_name;
  }

  for (const g of goalsCsv) {
    if (g.own_goal === "1") continue;
    const year = (g.tournament_name?.match(/\d{4}/) ?? ["0000"])[0];
    const key = `${g.player_id}:${year}`;
    const cur = statsByPlayer.get(key);
    if (cur) cur.goals += 1;
  }

  const playersExtended = [];
  const seasonStats = [];
  const mergedIds = new Set(curatedPlayers.map((p) => p.id));
  const mergedNorms = new Set(curatedPlayers.map((p) => normalizeName(p.name)));

  for (const p of curatedPlayers) {
    playersExtended.push({
      ...p,
      source: "curated",
      confidence: 0.98,
      decades: ["1990s", "2000s", "2010s", "2020s", "All-Time"],
    });
    for (const club of p.clubs ?? []) {
      seasonStats.push({
        playerId: p.id,
        seasonLabel: "career",
        competitionId: slugify(club) || "any-league",
        context: "CLUB",
        appearances: 80,
        goals: p.position === "Forward" ? 25 : p.position === "Goalkeeper" ? 0 : 5,
        assists: p.position === "Midfielder" ? 12 : 4,
        minutes: 6000,
        confidence: 0.65,
      });
    }
    const wcMatch = [...wcPlayerMap.values()].find((w) => w.norm === normalizeName(p.name));
    if (wcMatch) {
      for (const [key, stat] of statsByPlayer) {
        if (!key.startsWith(wcMatch.wcId + ":")) continue;
        seasonStats.push({
          playerId: p.id,
          seasonLabel: stat.seasonLabel,
          competitionId: "world-cup",
          context: "NATIONAL_TEAM",
          appearances: stat.appearances,
          goals: stat.goals,
          assists: stat.assists,
          minutes: stat.minutes,
          confidence: 0.92,
        });
      }
    }
  }

  let added = 0;
  for (const [wcId, wc] of wcPlayerMap) {
    if (curatedByNorm.has(wc.norm)) continue;
    const id = slugify(wc.name);
    if (mergedIds.has(id)) continue;
    const meta = squadMeta.get(wcId);
    if (!meta) continue;

    mergedIds.add(id);
    mergedNorms.add(wc.norm);
    added++;

    const decades = [...meta.decades];
    const clues = [
      `${meta.nationality} international.`,
      `World Cup appearances across ${meta.tournaments.size} tournament(s).`,
    ];

    playersExtended.push({
      id,
      name: wc.name,
      sport: "football",
      nationality: meta.nationality,
      position: wc.position,
      clubs: [],
      clues,
      source: "worldcup",
      confidence: 0.88,
      wcId,
      decades,
    });

    for (const [key, stat] of statsByPlayer) {
      if (!key.startsWith(wcId + ":")) continue;
      seasonStats.push({
        playerId: id,
        seasonLabel: stat.seasonLabel,
        competitionId: "world-cup",
        context: "NATIONAL_TEAM",
        appearances: stat.appearances,
        goals: stat.goals,
        assists: stat.assists,
        minutes: stat.minutes,
        confidence: 0.9,
      });
    }
  }

  const eraBaselines = buildEraBaselines();

  return {
    playersExtended,
    seasonStats,
    competitions,
    clubsExtended,
    eraBaselines,
    mergedNorms,
    mergedIds,
    meta: {
      addedFromWorldCup: added,
      totalPlayers: playersExtended.length,
      totalStats: seasonStats.length,
      clubsExtended: clubsExtended.length,
    },
  };
}

function buildEraBaselines() {
  const baselines = [];
  for (const league of LEAGUES) {
    const dir = resolve(FD, league.id);
    if (!existsSync(dir)) continue;
    const files = readdirSync(dir).filter((f) => f.startsWith("season-") && f.endsWith(".csv"));
    for (const file of files) {
      const label = file.replace("season-", "").replace(".csv", "");
      const rows = readCsv(resolve(dir, file));
      let goals = 0;
      const matches = rows.length;
      for (const r of rows) {
        goals += Number(r.FTHG || 0) + Number(r.FTAG || 0);
      }
      const gpg = matches ? goals / matches : 2.6;
      baselines.push({
        competitionId: league.id,
        seasonLabel: label,
        stat: "goals_per_game",
        mean: gpg,
        stdev: 0.8,
      });
    }
  }
  return baselines;
}
