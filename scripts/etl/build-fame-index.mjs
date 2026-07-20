#!/usr/bin/env node
/**
 * Build fame-index.json from archive market values, season stats, awards, injuries.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { ARCHIVE_DIR, OUT_DIR, streamCsv } from "./utils.mjs";

const MV_PATH = resolve(ARCHIVE_DIR, "player_market_value/player_market_value.csv");
const INJ_PATH = resolve(ARCHIVE_DIR, "player_injuries/player_injuries.csv");
const TM_PATH = resolve(ARCHIVE_DIR, "player_teammates_played_with/player_teammates_played_with.csv");

function eraBucket(year) {
  return Math.floor(year / 5) * 5;
}

/** Parse peak-MV year from archive column (ISO date, unix seconds, or unix ms). */
export function parseMarketValueYear(raw) {
  if (raw == null || raw === "") return 0;
  const s = String(raw).trim();
  const iso = s.match(/^(\d{4})-\d{2}-\d{2}/);
  if (iso) return Number(iso[1]);
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return 0;
  // Heuristic: values > 1e12 are ms; > 1e9 are seconds; else treat as year.
  if (n > 1e12) return new Date(n).getFullYear();
  if (n > 1e9) return new Date(n * 1000).getFullYear();
  if (n >= 1950 && n <= 2100) return Math.round(n);
  return 0;
}

function loadTmToCanonical() {
  const map = new Map();
  const playersPath = resolve(OUT_DIR, "players-extended.json");
  if (!existsSync(playersPath)) return map;
  const players = JSON.parse(readFileSync(playersPath, "utf8"));
  for (const p of players) {
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

function loadStatsAggregates() {
  const statsPath = resolve(OUT_DIR, "season-stats.json");
  if (!existsSync(statsPath)) return { apps: new Map(), intlApps: new Map() };
  const stats = JSON.parse(readFileSync(statsPath, "utf8"));
  const apps = new Map();
  const intlApps = new Map();
  for (const s of stats) {
    if (s.context === "NATIONAL_TEAM") {
      intlApps.set(s.playerId, (intlApps.get(s.playerId) ?? 0) + (s.appearances ?? 0));
    } else {
      apps.set(s.playerId, (apps.get(s.playerId) ?? 0) + (s.appearances ?? 0));
    }
  }
  return { apps, intlApps };
}

function loadAwardsCounts() {
  const awards = existsSync(resolve(OUT_DIR, "awards.json"))
    ? JSON.parse(readFileSync(resolve(OUT_DIR, "awards.json"), "utf8"))
    : [];
  const moments = existsSync(resolve(OUT_DIR, "iconic_moments.json"))
    ? JSON.parse(readFileSync(resolve(OUT_DIR, "iconic_moments.json"), "utf8"))
    : [];
  const counts = new Map();
  for (const a of awards) counts.set(a.playerId, (counts.get(a.playerId) ?? 0) + 1);
  for (const m of moments) counts.set(m.playerId, (counts.get(m.playerId) ?? 0) + 1);
  return counts;
}

function percentileInCohort(value, cohortValues) {
  if (!cohortValues.length) return 50;
  const sorted = [...cohortValues].sort((a, b) => a - b);
  let rank = 0;
  for (const v of sorted) if (v <= value) rank++;
  return (rank / sorted.length) * 100;
}

export async function buildFameIndex() {
  const tmToCanonical = loadTmToCanonical();
  const { apps, intlApps } = loadStatsAggregates();
  const awardCounts = loadAwardsCounts();

  const peakByPlayer = new Map();
  const cohortBuckets = new Map();

  if (existsSync(MV_PATH)) {
    await streamCsv(MV_PATH, (row) => {
      const tmId = row.player_id;
      const playerId = tmToCanonical.get(tmId);
      if (!playerId) return;
      const value = Number(row.value) || 0;
      if (value <= 0) return;
      // Column is named date_unix but archive ships ISO dates (YYYY-MM-DD) or unix seconds/ms.
      const year = parseMarketValueYear(row.date_unix);
      if (!year) return;
      const existing = peakByPlayer.get(playerId);
      if (!existing || value > existing.peakMv) {
        peakByPlayer.set(playerId, { peakMv: value, peakMvYear: year });
      }
    });

    for (const [, entry] of peakByPlayer) {
      const bucket = eraBucket(entry.peakMvYear);
      const list = cohortBuckets.get(bucket) ?? [];
      list.push(entry.peakMv);
      cohortBuckets.set(bucket, list);
    }
  }

  const durabilityByPlayer = new Map();
  if (existsSync(INJ_PATH)) {
    await streamCsv(INJ_PATH, (row) => {
      const tmId = row.player_id;
      const playerId = tmToCanonical.get(tmId);
      if (!playerId) return;
      const days = Number(row.days_missed) || 0;
      durabilityByPlayer.set(playerId, (durabilityByPlayer.get(playerId) ?? 0) + days);
    });
  }

  const curatedIds = new Set();
  try {
    for (const p of JSON.parse(readFileSync(resolve(OUT_DIR, "players.json"), "utf8"))) {
      curatedIds.add(p.id);
    }
  } catch { /* optional */ }

  // Boost hand-curated icons so they surface in draft pools
  const CURATED_FAME_FLOOR = 92;

  const allPlayerIds = new Set([
    ...peakByPlayer.keys(),
    ...apps.keys(),
    ...awardCounts.keys(),
    ...curatedIds,
  ]);

  const maxApps = Math.max(1, ...[...apps.values()]);
  const maxIntl = Math.max(1, ...[...intlApps.values()]);
  const maxAwards = Math.max(1, ...[...awardCounts.values()]);

  const entries = [];
  for (const playerId of allPlayerIds) {
    const peak = peakByPlayer.get(playerId);
    let mvPercentile = 0;
    if (peak) {
      const cohort = cohortBuckets.get(eraBucket(peak.peakMvYear)) ?? [];
      mvPercentile = percentileInCohort(peak.peakMv, cohort);
    } else {
      const appScore = ((apps.get(playerId) ?? 0) / maxApps) * 100;
      const awardScore = ((awardCounts.get(playerId) ?? 0) / maxAwards) * 100;
      mvPercentile = Math.min(95, appScore * 0.6 + awardScore * 0.4);
    }

    const appNorm = ((apps.get(playerId) ?? 0) / maxApps) * 100;
    const awardNorm = ((awardCounts.get(playerId) ?? 0) / maxAwards) * 100;
    const intlNorm = ((intlApps.get(playerId) ?? 0) / maxIntl) * 100;

    const fameScore = Math.round(
      mvPercentile * 0.5 + appNorm * 0.2 + awardNorm * 0.15 + intlNorm * 0.15,
    );

    const injuredDays = durabilityByPlayer.get(playerId) ?? 0;
    const durability = Math.max(0, Math.min(1, 1 - injuredDays / 2000));

    if (fameScore < 20 && !curatedIds.has(playerId)) continue;

    entries.push({
      playerId,
      fameScore: Math.min(100, curatedIds.has(playerId) ? Math.max(fameScore, CURATED_FAME_FLOOR) : fameScore),
      peakMv: peak?.peakMv ?? 0,
      peakMvYear: peak?.peakMvYear ?? 0,
      durability,
    });
  }

  entries.sort((a, b) => b.fameScore - a.fameScore);
  writeFileSync(resolve(OUT_DIR, "fame-index.json"), JSON.stringify(entries));
  console.log("fame-index:", { entries: entries.length });

  return { entries, meta: { count: entries.length } };
}

export async function buildPartnershipPairs(minStrength = 1.75, maxPairs = 5000) {
  const tmToCanonical = loadTmToCanonical();
  const pairCounts = new Map();

  if (!existsSync(TM_PATH)) {
    console.warn("Teammates CSV not found — skipping partnership pairs");
    return [];
  }

  await streamCsv(TM_PATH, (row) => {
    const a = tmToCanonical.get(row.player_id);
    const b = tmToCanonical.get(row.teammate_player_id);
    const ppg = Number(row.ppg_played_with) || 0;
    const minutes = Number(row.minutes_played_with) || 0;
    const strength = minutes > 0 ? minutes / 90 : ppg * 40;
    if (!a || !b || a === b || strength < minStrength) return;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    pairCounts.set(key, (pairCounts.get(key) ?? 0) + strength);
  });

  const pairs = [...pairCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxPairs)
    .map(([key, strength]) => {
      const [playerAId, playerBId] = key.split("|");
      const bonus = strength >= 200 ? 3 : strength >= 120 ? 2 : 1;
      return { playerAId, playerBId, chemistryBonus: bonus, label: `Strong link (${Math.round(strength)} co-min)` };
    });

  writeFileSync(resolve(OUT_DIR, "partnership-pairs.json"), JSON.stringify(pairs, null, 2));
  console.log("partnership-pairs:", pairs.length);
  return pairs;
}

if (process.argv[1]?.endsWith("build-fame-index.mjs")) {
  buildFameIndex()
    .then(() => buildPartnershipPairs())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
