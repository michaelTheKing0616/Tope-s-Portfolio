#!/usr/bin/env node
/**
 * Build club-season-rosters.json from archive player_performances (team_id/team_name).
 * Season-stats only store competitionId (league), so the wheel cannot rebuild real
 * club-seasons from stats alone — this artifact is the source of truth.
 */
import { readFileSync, writeFileSync, existsSync, cpSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { ARCHIVE_DIR, OUT_DIR, ROOT, streamCsv } from "./utils.mjs";
import { mapCompetition } from "./competition-map.mjs";

const PERF_PATH = resolve(ARCHIVE_DIR, "player_performances/player_performances.csv");
const FAME_PATH = resolve(OUT_DIR, "fame-index.json");
const OUT_PATH = resolve(OUT_DIR, "club-season-rosters.json");
const PUBLIC_OUT = resolve(ROOT, "sportverse/apps/web/public/data/club-season-rosters.json");

/** Sim needs ≥11 for a full XI + subs depth; wheel still filters separately. */
const MIN_SQUAD = 11;
const MAX_SQUAD = 40;
const FAMOUS_THRESHOLD = 55;
/** Primary fame gate — softened for big domestic leagues. */
const MIN_FAMOUS_DEFAULT = 2;
const MIN_FAMOUS_BIG_LEAGUE = 1;
/** Second pass: keep depth squads with at least one recognizable player. */
const MIN_FAMOUS_DEPTH_PASS = 1;
const DEPTH_PASS_MIN_FAME_SUM = 280;
/** Keep essentially all qualifying club-seasons (was 4000). */
const MAX_ENTRIES = 12_000;

const BIG_DOMESTIC_LEAGUES = new Set([
  "premier-league",
  "la-liga",
  "serie-a",
  "bundesliga",
  "ligue-1",
  "championship",
  "eredivisie",
  "primeira-liga",
  "super-lig",
  "scottish-premiership",
  "pro-league",
  "mls",
  "serie-a-brazil",
]);

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

function dominantDomesticLeague(leagueCounts) {
  if (!leagueCounts?.size) return undefined;
  let bestId;
  let bestN = 0;
  for (const [id, n] of leagueCounts) {
    if (n > bestN) {
      bestN = n;
      bestId = id;
    }
  }
  return bestId;
}

function passesFameGate(playerIds, fame, leagueId) {
  const famousCount = playerIds.filter((id) => (fame.get(id) ?? 0) >= FAMOUS_THRESHOLD).length;
  const fameSum = playerIds.reduce((s, id) => s + (fame.get(id) ?? 0), 0);
  const minFamous =
    leagueId && BIG_DOMESTIC_LEAGUES.has(leagueId) ? MIN_FAMOUS_BIG_LEAGUE : MIN_FAMOUS_DEFAULT;
  if (famousCount >= minFamous) return true;
  // Depth pass — sim needs squads even when fameSum is modest.
  if (
    playerIds.length >= MIN_SQUAD &&
    famousCount >= MIN_FAMOUS_DEPTH_PASS &&
    fameSum >= DEPTH_PASS_MIN_FAME_SUM
  ) {
    return true;
  }
  return false;
}

function coverageSummary(entries) {
  const byLeagueSeason = new Map();
  for (const e of entries) {
    if (!e.leagueId) continue;
    const key = `${e.leagueId}::${e.seasonLabel}`;
    byLeagueSeason.set(key, (byLeagueSeason.get(key) ?? 0) + 1);
  }
  const top = [...byLeagueSeason.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([key, n]) => {
      const [leagueId, seasonLabel] = key.split("::");
      return { leagueId, seasonLabel, clubs: n };
    });
  return top;
}

export async function buildClubSeasonRosters() {
  if (!existsSync(PERF_PATH)) {
    console.warn("[club-season] archive performances missing — skip");
    return null;
  }
  const tmToCanonical = loadTmToCanonical();
  const fame = loadFameScores();
  /** @type {Map<string, { players: Set<string>, leagues: Map<string, number> }>} */
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
    let bucket = squadByKey.get(key);
    if (!bucket) {
      bucket = { players: new Set(), leagues: new Map() };
      squadByKey.set(key, bucket);
    }
    bucket.players.add(playerId);

    const comp = mapCompetition(row.competition_id, row.competition_name);
    if (comp.type === "domestic_league" && comp.id !== "unknown") {
      bucket.leagues.set(comp.id, (bucket.leagues.get(comp.id) ?? 0) + 1);
    }
  });

  const entries = [];
  for (const [key, bucket] of squadByKey) {
    const sep = key.indexOf("::");
    const clubName = key.slice(0, sep);
    const seasonLabel = key.slice(sep + 2);
    const playerIds = [...bucket.players];
    if (playerIds.length < MIN_SQUAD || playerIds.length > MAX_SQUAD) continue;

    const leagueId = dominantDomesticLeague(bucket.leagues);
    if (!passesFameGate(playerIds, fame, leagueId)) continue;

    const fameSum = playerIds.reduce((s, id) => s + (fame.get(id) ?? 0), 0);
    const entry = {
      clubId: clubName.toLowerCase().replace(/\s+/g, "-").slice(0, 64),
      clubName,
      seasonLabel,
      playerIds,
      fameSum,
    };
    if (leagueId) entry.leagueId = leagueId;
    entries.push(entry);
  }

  entries.sort((a, b) => b.fameSum - a.fameSum);
  const trimmed = entries.slice(0, MAX_ENTRIES);
  writeFileSync(OUT_PATH, JSON.stringify(trimmed));

  mkdirSync(dirname(PUBLIC_OUT), { recursive: true });
  cpSync(OUT_PATH, PUBLIC_OUT);

  const topCoverage = coverageSummary(trimmed);
  console.log("club-season-rosters:", {
    perfRows: rows,
    mappedPlayers: mapped,
    rawKeys: squadByKey.size,
    kept: trimmed.length,
    cappedAt: MAX_ENTRIES,
    withLeagueId: trimmed.filter((e) => e.leagueId).length,
    bytes: Buffer.byteLength(JSON.stringify(trimmed)),
    top: trimmed.slice(0, 5).map((e) => `${e.clubName} ${e.seasonLabel} n=${e.playerIds.length}`),
    topLeagueSeasonCoverage: topCoverage,
  });
  return trimmed;
}

if (process.argv[1]?.endsWith("build-club-season-index.mjs")) {
  buildClubSeasonRosters().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
