#!/usr/bin/env node
/**
 * Build club-season-rosters.json from archive player_performances (team_id/team_name).
 * Season-stats only store competitionId (league), so the wheel cannot rebuild real
 * club-seasons from stats alone — this artifact is the source of truth.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { ARCHIVE_DIR, OUT_DIR, streamCsv } from "./utils.mjs";

const PERF_PATH = resolve(ARCHIVE_DIR, "player_performances/player_performances.csv");
const FAME_PATH = resolve(OUT_DIR, "fame-index.json");
const OUT_PATH = resolve(OUT_DIR, "club-season-rosters.json");

const MIN_SQUAD = 14;
const MAX_SQUAD = 40;
const MIN_FAMOUS = 3;
const FAMOUS_THRESHOLD = 55;
/** Cap artifact size — keep the most recognizable club-seasons. */
const MAX_ENTRIES = 4000;

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

function loadFameScores() {
  const map = new Map();
  if (!existsSync(FAME_PATH)) return map;
  for (const e of JSON.parse(readFileSync(FAME_PATH, "utf8"))) {
    map.set(e.playerId, e.fameScore ?? 0);
  }
  return map;
}

function looksLikeCompetitionId(name) {
  const s = String(name).trim().toLowerCase();
  if (!s) return true;
  if (/^tm[\s_-]/i.test(s)) return true;
  if (/^tm-c[a-z0-9]+$/i.test(s)) return true;
  if (/^[a-z]{2,3}-\d+$/i.test(s)) return true;
  if (s.includes("competition") || s.startsWith("comp-")) return true;
  // Youth / reserve sides muddy the wheel — keep first-team seasons only.
  if (/\b(u\d{2}|u-\d{2}|youth|reserves|\bii\b|\b b\b| academy)\b/i.test(s)) return true;
  const leagueLike = new Set([
    "premier-league",
    "la-liga",
    "serie-a",
    "bundesliga",
    "ligue-1",
    "eredivisie",
    "primeira-liga",
    "championship",
    "world-cup",
    "champions-league",
    "europa-league",
  ]);
  return leagueLike.has(s);
}

export async function buildClubSeasonRosters() {
  if (!existsSync(PERF_PATH)) {
    console.warn("[club-season] archive performances missing — skip");
    return null;
  }
  const tmToCanonical = loadTmToCanonical();
  const fame = loadFameScores();
  const squadByKey = new Map();

  let rows = 0;
  let mapped = 0;
  await streamCsv(PERF_PATH, async (row) => {
    rows++;
    const playerId = tmToCanonical.get(String(row.player_id));
    if (!playerId) return;
    const apps = Number(row.nb_on_pitch) || Number(row.nb_in_group) || 0;
    if (apps < 1) return;
    const clubName = cleanClubName(row.team_name);
    const seasonLabel = String(row.season_name || "").trim();
    if (!clubName || !seasonLabel || looksLikeCompetitionId(clubName)) return;
    mapped++;
    const key = `${clubName}::${seasonLabel}`;
    let set = squadByKey.get(key);
    if (!set) {
      set = new Set();
      squadByKey.set(key, set);
    }
    set.add(playerId);
  });

  const entries = [];
  for (const [key, playerSet] of squadByKey) {
    const sep = key.indexOf("::");
    const clubName = key.slice(0, sep);
    const seasonLabel = key.slice(sep + 2);
    const playerIds = [...playerSet];
    if (playerIds.length < MIN_SQUAD || playerIds.length > MAX_SQUAD) continue;
    const famousCount = playerIds.filter((id) => (fame.get(id) ?? 0) >= FAMOUS_THRESHOLD).length;
    if (famousCount < MIN_FAMOUS) continue;
    const fameSum = playerIds.reduce((s, id) => s + (fame.get(id) ?? 0), 0);
    entries.push({
      clubId: clubName.toLowerCase().replace(/\s+/g, "-").slice(0, 64),
      clubName,
      seasonLabel,
      playerIds,
      fameSum,
    });
  }

  entries.sort((a, b) => b.fameSum - a.fameSum);
  const trimmed = entries.slice(0, MAX_ENTRIES);
  writeFileSync(OUT_PATH, JSON.stringify(trimmed));
  console.log("club-season-rosters:", {
    perfRows: rows,
    mappedPlayers: mapped,
    rawKeys: squadByKey.size,
    kept: trimmed.length,
    bytes: Buffer.byteLength(JSON.stringify(trimmed)),
    top: trimmed.slice(0, 5).map((e) => `${e.clubName} ${e.seasonLabel} n=${e.playerIds.length}`),
  });
  return trimmed;
}

if (process.argv[1]?.endsWith("build-club-season-index.mjs")) {
  buildClubSeasonRosters().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
