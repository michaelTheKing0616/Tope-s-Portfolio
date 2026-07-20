import { resolve } from "node:path";
import {
  ARCHIVE_DIR,
  normalizeName,
  slugify,
  readCsv,
  streamCsv,
} from "./utils.mjs";
import {
  mapCompetition,
  mapArchivePosition,
  seasonNameToDecade,
} from "./competition-map.mjs";

const PATHS = {
  profiles: resolve(ARCHIVE_DIR, "player_profiles/player_profiles.csv"),
  performances: resolve(ARCHIVE_DIR, "player_performances/player_performances.csv"),
  national: resolve(ARCHIVE_DIR, "player_national_performances/player_national_performances.csv"),
  transfers: resolve(ARCHIVE_DIR, "transfer_history/transfer_history.csv"),
  teamDetails: resolve(ARCHIVE_DIR, "team_details/team_details.csv"),
  teamSeasons: resolve(ARCHIVE_DIR, "team_competitions_seasons/team_competitions_seasons.csv"),
};

function statKey(playerId, seasonLabel, competitionId, context) {
  return `${playerId}|${seasonLabel}|${competitionId}|${context}`;
}

function upsertStat(map, row) {
  const key = statKey(row.playerId, row.seasonLabel, row.competitionId, row.context);
  const existing = map.get(key);
  if (!existing || row.confidence > existing.confidence || row.appearances > existing.appearances) {
    map.set(key, { ...row, clubName: row.clubName || existing?.clubName });
  } else if (existing) {
    existing.appearances += row.appearances;
    existing.goals += row.goals;
    existing.assists += row.assists;
    existing.minutes += row.minutes;
    if (row.clubName && !existing.clubName) existing.clubName = row.clubName;
  }
}

/**
 * Primary Transfermarkt ingest from local archive CSVs.
 * Merges with football-datasets base (curated + WC).
 */
export async function buildFromArchive(footballBase, curatedPlayers) {
  const curatedByNorm = new Map(curatedPlayers.map((p) => [normalizeName(p.name), p]));
  const wcByNorm = new Map(
    footballBase.playersExtended
      .filter((p) => p.source === "worldcup")
      .map((p) => [normalizeName(p.name), p]),
  );

  const tmToCanonical = new Map();
  const aliases = [];
  const profiles = readCsv(PATHS.profiles);
  const teamNames = new Map();

  for (const row of readCsv(PATHS.teamDetails)) {
    if (row.club_id && row.club_name) {
      teamNames.set(row.club_id, row.club_name.replace(/\s*\(\d+\)\s*$/, "").trim());
    }
  }

  const competitionsMap = new Map();
  for (const c of footballBase.competitions) competitionsMap.set(c.id, c);

  const clubsMap = new Map();
  for (const c of footballBase.clubsExtended) clubsMap.set(c.id, c);

  for (const row of readCsv(PATHS.teamSeasons)) {
    if (!row.club_id || !row.competition_id) continue;
    const mapped = mapCompetition(row.competition_id, row.competition_name);
    competitionsMap.set(mapped.id, mapped);
    const clubName = teamNames.get(row.club_id) ?? row.team_name?.replace(/\s*\(\d+\)\s*$/, "").trim();
    if (!clubName) continue;
    const clubId = slugify(`${mapped.id}-${clubName}`);
    if (!clubsMap.has(clubId)) {
      clubsMap.set(clubId, {
        id: clubId,
        name: clubName,
        league: mapped.id,
        country: mapped.country || "",
      });
    }
  }

  const playersMap = new Map();
  for (const p of footballBase.playersExtended) {
    playersMap.set(p.id, { ...p });
  }

  const clubsByTmPlayer = new Map();

  for (const row of profiles) {
    const tmId = row.player_id;
    if (!tmId) continue;
    const name = row.player_name?.replace(/\s*\(\d+\)\s*$/, "").trim() || row.player_name;
    const norm = normalizeName(name);
    const curated = curatedByNorm.get(norm);
    const wc = wcByNorm.get(norm);

    let canonicalId;
    if (curated) {
      canonicalId = curated.id;
      tmToCanonical.set(tmId, canonicalId);
      aliases.push({ curatedId: curated.id, tmId, name, source: "curated" });
      const existing = playersMap.get(canonicalId);
      if (existing) {
        existing.tmId = tmId;
        existing.confidence = Math.max(existing.confidence ?? 0.98, 0.98);
        if (row.citizenship) existing.nationality = row.citizenship.split(",")[0]?.trim() || existing.nationality;
      }
    } else if (wc) {
      canonicalId = wc.id;
      tmToCanonical.set(tmId, canonicalId);
      aliases.push({ curatedId: wc.id, tmId, name, source: "worldcup" });
      const existing = playersMap.get(canonicalId);
      if (existing) {
        existing.tmId = tmId;
        existing.confidence = 0.9;
        if (row.citizenship) existing.nationality = row.citizenship.split(",")[0]?.trim() || existing.nationality;
        if (row.current_club_name && row.current_club_name !== "Retired") {
          existing.clubs = [...new Set([...(existing.clubs ?? []), row.current_club_name.replace(/\s*\(\d+\)\s*$/, "")])].slice(0, 12);
        }
      }
    } else {
      canonicalId = `tm-${tmId}`;
      tmToCanonical.set(tmId, canonicalId);
      if (playersMap.has(canonicalId)) continue;

      const clubs = [];
      if (row.current_club_name && row.current_club_name !== "Without Club" && row.current_club_name !== "Retired") {
        clubs.push(row.current_club_name.replace(/\s*\(\d+\)\s*$/, "").trim());
      }

      playersMap.set(canonicalId, {
        id: canonicalId,
        name,
        sport: "football",
        nationality: row.citizenship?.split(",")[0]?.trim() || row.country_of_birth || "",
        position: mapArchivePosition(row.main_position, row.position),
        clubs,
        clues: [
          clubs[0] ? `Club career includes ${clubs[0]}.` : "Professional record on file.",
          row.date_of_birth ? `Born ${row.date_of_birth.slice(0, 10)}.` : "Transfermarkt profile.",
        ],
        source: "transfermarkt",
        confidence: 0.93,
        tmId,
        decades: [],
      });
    }

    if (row.current_club_name && row.current_club_name !== "Retired") {
      const set = clubsByTmPlayer.get(tmId) ?? new Set();
      set.add(row.current_club_name.replace(/\s*\(\d+\)\s*$/, "").trim());
      clubsByTmPlayer.set(tmId, set);
    }
  }

  console.log("  archive profiles:", profiles.length, "canonical map:", tmToCanonical.size);

  let transferRows = 0;
  await streamCsv(PATHS.transfers, async (row) => {
    const tmId = row.player_id;
    if (!tmToCanonical.has(tmId)) return;
    transferRows++;
    const set = clubsByTmPlayer.get(tmId) ?? new Set();
    for (const c of [row.from_team_name, row.to_team_name]) {
      if (!c || c === "Retired" || c === "Without Club") continue;
      set.add(c.replace(/\s*\(\d+\)\s*$/, "").trim());
    }
    clubsByTmPlayer.set(tmId, set);
  });

  for (const [tmId, clubSet] of clubsByTmPlayer) {
    const canonicalId = tmToCanonical.get(tmId);
    if (!canonicalId) continue;
    const p = playersMap.get(canonicalId);
    if (!p) continue;
    p.clubs = [...new Set([...(p.clubs ?? []), ...clubSet])].filter(Boolean).slice(0, 15);
  }

  const statMap = new Map();
  for (const s of footballBase.seasonStats) {
    upsertStat(statMap, s);
  }

  let perfRows = 0;
  await streamCsv(PATHS.performances, async (row) => {
    const tmId = row.player_id;
    const playerId = tmToCanonical.get(tmId);
    if (!playerId) return;
    perfRows++;

    const mapped = mapCompetition(row.competition_id, row.competition_name);
    competitionsMap.set(mapped.id, mapped);

    const apps = Number(row.nb_on_pitch) || Number(row.nb_in_group) || 0;
    if (apps < 1) return;

    const clubName = String(row.team_name ?? "")
      .replace(/\s*\(\d+\)\s*$/, "")
      .replace(/\s+/g, " ")
      .trim();
    upsertStat(statMap, {
      playerId,
      seasonLabel: row.season_name || "unknown",
      competitionId: mapped.id,
      context: "CLUB",
      appearances: apps,
      goals: Math.round(Number(row.goals) || 0),
      assists: Math.round(Number(row.assists) || 0),
      minutes: Math.round(Number(row.minutes_played) || apps * 75),
      confidence: 0.94,
      goalsConceded: Math.round(Number(row.goals_conceded) || 0),
      ...(clubName ? { clubName } : {}),
    });
  });

  let natRows = 0;
  await streamCsv(PATHS.national, async (row) => {
    const tmId = row.player_id;
    const playerId = tmToCanonical.get(tmId);
    if (!playerId) return;
    natRows++;
    const apps = Number(row.matches) || 0;
    if (apps < 1) return;
    const teamName = teamNames.get(row.team_id) ?? "National Team";
    upsertStat(statMap, {
      playerId,
      seasonLabel: "intl-career",
      competitionId: "international",
      context: "NATIONAL_TEAM",
      appearances: apps,
      goals: Math.round(Number(row.goals) || 0),
      assists: 0,
      minutes: apps * 85,
      confidence: 0.91,
    });
    const p = playersMap.get(playerId);
    if (p && !p.nationality && teamName !== "National Team") {
      p.nationality = teamName;
    }
  });

  const decadesByPlayer = new Map();
  for (const stat of statMap.values()) {
    const decade = seasonNameToDecade(stat.seasonLabel);
    const set = decadesByPlayer.get(stat.playerId) ?? new Set();
    set.add(decade);
    decadesByPlayer.set(stat.playerId, set);
  }

  for (const [id, p] of playersMap) {
    const decades = decadesByPlayer.get(id);
    if (decades?.size) p.decades = [...decades];
  }

  const playersExtended = [...playersMap.values()];
  const seasonStats = [...statMap.values()];
  const competitions = [...competitionsMap.values()];
  const clubsExtended = [...clubsMap.values()];
  const eraBaselines = buildEraBaselinesFromStats(statMap, footballBase.eraBaselines);
  const mergedIds = new Set(playersExtended.map((p) => p.id));
  const mergedNorms = new Set(playersExtended.map((p) => normalizeName(p.name)));

  return {
    playersExtended,
    seasonStats,
    competitions,
    clubsExtended,
    eraBaselines,
    playerAliases: aliases,
    mergedIds,
    mergedNorms,
    meta: {
      archiveProfiles: profiles.length,
      archivePerformances: perfRows,
      archiveNational: natRows,
      archiveTransfers: transferRows,
      totalPlayers: playersExtended.length,
      totalStats: seasonStats.length,
      competitions: competitions.length,
      clubsExtended: clubsExtended.length,
      aliases: aliases.length,
    },
  };
}

function buildEraBaselinesFromStats(statMap, existingBaselines) {
  const agg = new Map();
  for (const stat of statMap.values()) {
    if (stat.context !== "CLUB" || stat.appearances < 1) continue;
    const key = `${stat.competitionId}|${stat.seasonLabel}`;
    const cur = agg.get(key) ?? {
      competitionId: stat.competitionId,
      seasonLabel: stat.seasonLabel,
      goals: 0,
      apps: 0,
    };
    cur.goals += stat.goals;
    cur.apps += stat.appearances;
    agg.set(key, cur);
  }

  const baselines = [...existingBaselines];
  for (const row of agg.values()) {
    if (row.apps < 200) continue;
    baselines.push({
      competitionId: row.competitionId,
      seasonLabel: row.seasonLabel,
      stat: "goals_per_appearance",
      mean: row.goals / row.apps,
      stdev: 0.12,
    });
  }
  return baselines;
}
