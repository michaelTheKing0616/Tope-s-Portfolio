#!/usr/bin/env node
/**
 * Build historical-ratings-index.json — SoFIFA peaks + tier-2 peak-MV anchors.
 *
 * Sources:
 *   sportverse/data/raw/open-football/sofifa/player-ratings-index.json  (FC26 bulk)
 *   sportverse/data/raw/open-football/sofifa/player-ratings-history.json (legend peaks)
 *   sportverse/packages/sports-db/data/fame-index.json (tier-2 retired anchors)
 *   sportverse/packages/sports-db/data/season-stats.json (tier-3 career workload)
 *
 * Excludes players already in legend-ratings.json or ea-fc26-index.json (those paths
 * are handled separately at runtime). Tier-2 fills the gap for retired non-legends
 * with meaningful peak market value (early-2000s La Liga squads, etc.).
 *
 * Output:
 *   sportverse/packages/sports-db/data/historical-ratings-index.json
 *   sportverse/apps/web/public/data/historical-ratings-index.json
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { OUT_DIR } from "./utils.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SOFIFA_DIR = resolve(ROOT, "sportverse/data/raw/open-football/sofifa");
const BULK_JSON = resolve(SOFIFA_DIR, "player-ratings-index.json");
const HISTORY_JSON = resolve(SOFIFA_DIR, "player-ratings-history.json");
const FAME_JSON = resolve(OUT_DIR, "fame-index.json");
const LEGENDS_JSON = resolve(OUT_DIR, "legend-ratings.json");
const EA_JSON = resolve(OUT_DIR, "ea-fc26-index.json");
const STATS_JSON = resolve(OUT_DIR, "season-stats.json");
const OUT_JSON = resolve(OUT_DIR, "historical-ratings-index.json");
const PUBLIC_JSON = resolve(ROOT, "sportverse/apps/web/public/data/historical-ratings-index.json");

/** 5-year market era bucket — mirrors rating-engine fame-data.ts */
function mvEraBucket(year) {
  if (year == null || year < 1950 || year > 2100) return 0;
  return Math.floor(year / 5) * 5;
}

function attachMvPercentiles(entries) {
  const maxByBucket = new Map();
  for (const e of entries) {
    if (e.peakMv == null || e.peakMv <= 0) continue;
    const bucket = mvEraBucket(e.peakMvYear);
    maxByBucket.set(bucket, Math.max(maxByBucket.get(bucket) ?? 0, e.peakMv));
  }
  return entries.map((e) => {
    if (e.peakMv == null || e.peakMv <= 0) {
      return { ...e, mvPercentile: e.mvPercentile ?? 0 };
    }
    const max = maxByBucket.get(mvEraBucket(e.peakMvYear)) ?? 0;
    const share = max > 0 ? (e.peakMv / max) * 100 : 0;
    return { ...e, mvPercentile: share };
  });
}

/** Convert era-normalized MV share → prime OVR anchor (tier-2). */
export function peakMvToTier2Ovr(mvPct) {
  if (mvPct <= 0) return 0;
  const raw = Math.round(58 + mvPct * 0.38);
  if (mvPct >= 40) return Math.min(91, Math.max(raw, 75));
  if (mvPct >= 25) return Math.min(88, Math.max(raw, 68));
  if (mvPct >= 15) return Math.min(84, Math.max(raw, 65));
  if (mvPct >= 8) return Math.min(78, Math.max(raw, 62));
  return 0;
}

/** Top-flight + continental comps — career workload tier-3. */
const TOP_COMPETITIONS = new Set([
  "premier-league",
  "la-liga",
  "serie-a",
  "bundesliga",
  "ligue-1",
  "champions-league",
  "europa-league",
]);

/** Map sustained top-league minutes/apps → prime floor for non-MV retirees. */
export function careerWorkloadToPeakOvr(apps, minutes) {
  if (apps >= 150 || minutes >= 10_000) return 78;
  if (apps >= 100 || minutes >= 7000) return 75;
  if (apps >= 60 || minutes >= 4500) return 72;
  if (apps >= 30 || minutes >= 2000) return 68;
  if (apps >= 15 || minutes >= 900) return 65;
  return 0;
}

function statApps(row) {
  return Number(row.appearances ?? row.apps ?? 0) || 0;
}

function statMinutes(row) {
  return Number(row.minutes ?? row.minutesPlayed ?? 0) || 0;
}

function buildCareerWorkload(byId, skipIds) {
  if (!existsSync(STATS_JSON)) return 0;
  const stats = loadJson(STATS_JSON, []) ?? [];
  const workload = new Map();
  for (const row of stats) {
    const cid = String(row.competitionId ?? row.league ?? "");
    if (!TOP_COMPETITIONS.has(cid)) continue;
    const playerId = row.playerId;
    if (!playerId || skipIds.has(playerId)) continue;
    const cur = workload.get(playerId) ?? { apps: 0, minutes: 0 };
    cur.apps += statApps(row);
    cur.minutes += statMinutes(row);
    workload.set(playerId, cur);
  }

  let tier3 = 0;
  for (const [playerId, agg] of workload) {
    const peakOvr = careerWorkloadToPeakOvr(agg.apps, agg.minutes);
    if (peakOvr <= 0) continue;
    const prev = byId.get(playerId);
    if (prev && prev.peakOvr >= peakOvr) continue;
    upsert(byId, {
      playerId,
      peakOvr,
      source: "career_workload_tier3",
      careerApps: agg.apps,
      careerMinutes: agg.minutes,
    });
    tier3++;
  }
  return tier3;
}

function loadJson(path, fallback = null) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

function upsert(map, entry) {
  const id = entry.playerId;
  if (!id) return;
  const prev = map.get(id);
  if (!prev || entry.peakOvr > prev.peakOvr) {
    map.set(id, entry);
    return;
  }
  if (entry.peakOvr === prev.peakOvr && entry.attributes && !prev.attributes) {
    map.set(id, { ...prev, attributes: entry.attributes, source: entry.source });
  }
}

export function buildHistoricalRatingsIndex() {
  const legendIds = new Set((loadJson(LEGENDS_JSON, []) ?? []).map((e) => e.playerId));
  const eaIds = new Set((loadJson(EA_JSON, []) ?? []).map((e) => e.playerId));
  const skipIds = new Set([...legendIds, ...eaIds]);

  const byId = new Map();
  let sofifaBulk = 0;
  let sofifaHistory = 0;
  let tier2 = 0;
  let tier3 = 0;

  const bulk = loadJson(BULK_JSON);
  if (bulk?.players) {
    for (const row of bulk.players) {
      const playerId = row.sportverse_id;
      if (!playerId || skipIds.has(playerId)) continue;
      const peak = Number(row.overall) || 0;
      if (peak <= 0) continue;
      upsert(byId, {
        playerId,
        peakOvr: peak,
        source: "sofifa_csv_fc26",
        sofifaId: row.sofifa_id ?? null,
        name: row.name,
        attributes: row.attributes ?? undefined,
        quizPosition: row.quiz_position ?? undefined,
      });
      sofifaBulk++;
    }
  }

  const history = loadJson(HISTORY_JSON);
  if (history?.players) {
    for (const row of history.players) {
      const playerId = row.sportverse_id;
      if (!playerId || skipIds.has(playerId)) continue;
      const peak = Number(row.peak_overall) || 0;
      if (peak <= 0) continue;
      upsert(byId, {
        playerId,
        peakOvr: peak,
        source: row.source ?? "sofifa_history",
        sofifaId: row.sofifa_id ?? null,
        name: row.resolved_name,
        attributes: row.attributes && Object.keys(row.attributes).length ? row.attributes : undefined,
      });
      sofifaHistory++;
    }
  }

  const fameRaw = loadJson(FAME_JSON, []) ?? [];
  const fame = attachMvPercentiles(fameRaw);
  for (const e of fame) {
    const playerId = e.playerId;
    if (!playerId || skipIds.has(playerId) || byId.has(playerId)) continue;
    const mvPct = e.mvPercentile ?? 0;
    const peakMv = e.peakMv ?? 0;
    if (peakMv < 100_000 || mvPct < 8) continue;
    const peakOvr = peakMvToTier2Ovr(mvPct);
    if (peakOvr <= 0) continue;
    upsert(byId, {
      playerId,
      peakOvr,
      source: "peak_mv_tier2",
      peakMv,
      peakMvYear: e.peakMvYear,
      mvPercentile: Math.round(mvPct * 10) / 10,
    });
    tier2++;
  }

  tier3 = buildCareerWorkload(byId, skipIds);

  const entries = [...byId.values()].sort((a, b) => b.peakOvr - a.peakOvr);
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    counts: {
      total: entries.length,
      sofifa_bulk: sofifaBulk,
      sofifa_history: sofifaHistory,
      peak_mv_tier2: tier2,
      career_workload_tier3: tier3,
      skipped_legend_or_ea: skipIds.size,
    },
    entries,
  };
}

function main() {
  const payload = buildHistoricalRatingsIndex();
  writeFileSync(OUT_JSON, JSON.stringify(payload.entries));
  writeFileSync(PUBLIC_JSON, JSON.stringify(payload.entries));
  console.log(`✓ historical-ratings-index.json: ${payload.entries.length} entries`);
  console.log(`  sofifa bulk: ${payload.counts.sofifa_bulk}`);
  console.log(`  sofifa history: ${payload.counts.sofifa_history}`);
  console.log(`  peak-MV tier-2: ${payload.counts.peak_mv_tier2}`);
  console.log(`  career workload tier-3: ${payload.counts.career_workload_tier3}`);
  console.log(`  → ${OUT_JSON}`);
  console.log(`  → ${PUBLIC_JSON}`);
}

const isMain = process.argv[1]?.endsWith("build-historical-ratings-index.mjs");
if (isMain) main();

export { buildHistoricalRatingsIndex as default };
