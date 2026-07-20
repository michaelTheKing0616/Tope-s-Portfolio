#!/usr/bin/env node
/**
 * Backfill PlayerSeasonStat.clubName from archive player_performances.team_name
 * without a full season-stats rebuild. Idempotent.
 *
 * Match key: playerId + seasonLabel → club with most appearances that season
 * (competitionId slug mapping differs between ETL versions).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { ARCHIVE_DIR, OUT_DIR, streamCsv } from "./utils.mjs";

const PERF_PATH = resolve(ARCHIVE_DIR, "player_performances/player_performances.csv");
const STATS_PATH = resolve(OUT_DIR, "season-stats.json");

function cleanClubName(raw) {
  return String(raw ?? "")
    .replace(/\s*\(\d+\)\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function loadTmToCanonical() {
  const map = new Map();
  const playersPath = resolve(OUT_DIR, "players-extended.json");
  if (!existsSync(playersPath)) return map;
  for (const p of JSON.parse(readFileSync(playersPath, "utf8"))) {
    if (p.tmId) map.set(String(p.tmId), p.id);
  }
  const aliasesPath = resolve(OUT_DIR, "player-aliases.json");
  if (existsSync(aliasesPath)) {
    for (const a of JSON.parse(readFileSync(aliasesPath, "utf8"))) {
      if (a.tmId && a.curatedId) map.set(String(a.tmId), a.curatedId);
    }
  }
  return map;
}

export async function enrichSeasonStatsClubs() {
  if (!existsSync(PERF_PATH) || !existsSync(STATS_PATH)) {
    console.warn("[enrich-clubs] missing archive or season-stats — skip");
    return null;
  }
  const tmToCanonical = loadTmToCanonical();
  /** key: playerId|seasonLabel → Map<clubName, apps> */
  const appsByPlayerSeason = new Map();

  await streamCsv(PERF_PATH, async (row) => {
    const playerId = tmToCanonical.get(String(row.player_id));
    if (!playerId) return;
    const apps = Number(row.nb_on_pitch) || Number(row.nb_in_group) || 0;
    if (apps < 1) return;
    const clubName = cleanClubName(row.team_name);
    if (!clubName || /^tm[\s_-]/i.test(clubName)) return;
    const seasonLabel = String(row.season_name || "").trim();
    if (!seasonLabel) return;
    const key = `${playerId}|${seasonLabel}`;
    let clubMap = appsByPlayerSeason.get(key);
    if (!clubMap) {
      clubMap = new Map();
      appsByPlayerSeason.set(key, clubMap);
    }
    clubMap.set(clubName, (clubMap.get(clubName) ?? 0) + apps);
  });

  const primaryClub = new Map();
  for (const [key, clubMap] of appsByPlayerSeason) {
    let best = null;
    let bestApps = -1;
    for (const [club, apps] of clubMap) {
      if (apps > bestApps) {
        best = club;
        bestApps = apps;
      }
    }
    if (best) primaryClub.set(key, best);
  }

  const stats = JSON.parse(readFileSync(STATS_PATH, "utf8"));
  let filled = 0;
  let already = 0;
  for (const s of stats) {
    if (s.context !== "CLUB") continue;
    if (s.clubName) {
      already++;
      continue;
    }
    const club = primaryClub.get(`${s.playerId}|${s.seasonLabel}`);
    if (club) {
      s.clubName = club;
      filled++;
    }
  }

  writeFileSync(STATS_PATH, JSON.stringify(stats));
  console.log("enrich-season-stats-clubs:", {
    playerSeasons: primaryClub.size,
    filled,
    alreadyHadClubName: already,
    totalClubRows: stats.filter((s) => s.context === "CLUB").length,
  });
  return { filled, already };
}

if (process.argv[1]?.endsWith("enrich-season-stats-clubs.mjs")) {
  enrichSeasonStatsClubs().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
