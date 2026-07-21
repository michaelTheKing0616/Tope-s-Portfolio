#!/usr/bin/env node
/**
 * Build position-percentile breakpoints from season-stats + player positions.
 * Output: sportverse/packages/sports-db/data/position-percentiles.json
 *
 * Run after seed-external-data: node scripts/etl/build-position-percentiles.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");
const DATA = resolve(ROOT, "sportverse/packages/sports-db/data");
const OUT = resolve(DATA, "position-percentiles.json");

const POSITIONS = ["ST", "W", "AM", "CM", "DM", "FB", "CB", "GK"];
const METRICS = [
  "npxg_per_90",
  "goals_per_90",
  "assists_per_90",
  "goal_involvement_per_90",
  "minutes_per_app",
  "clean_sheet_rate",
  "goals_conceded_per_90",
  "discipline_per_90",
];

function mapQuizPosition(position = "") {
  const p = position.toLowerCase();
  if (p.includes("goal")) return "GK";
  if (p.includes("back") || p.includes("defend")) return p.includes("cent") ? "CB" : "FB";
  if (p.includes("striker") || p.includes("forward")) return "ST";
  if (p.includes("winger") || p.includes("wing")) return "W";
  if (p.includes("attacking")) return "AM";
  if (p.includes("defensive mid")) return "DM";
  if (p.includes("mid")) return "CM";
  return "CM";
}

function quantile(sorted, q) {
  const idx = (sorted.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function breakpoints(values) {
  if (values.length < 50) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return {
    p10: quantile(sorted, 0.1),
    p25: quantile(sorted, 0.25),
    p50: quantile(sorted, 0.5),
    p75: quantile(sorted, 0.75),
    p90: quantile(sorted, 0.9),
    n: values.length,
  };
}

function main() {
  const playersPath = resolve(DATA, "players-extended.json");
  const statsPath = resolve(DATA, "season-stats.json");
  if (!existsSync(playersPath) || !existsSync(statsPath)) {
    console.error("Missing players-extended.json or season-stats.json — run seed-external-data first.");
    process.exit(1);
  }

  const players = JSON.parse(readFileSync(playersPath, "utf8"));
  const stats = JSON.parse(readFileSync(statsPath, "utf8"));
  const posById = new Map(players.map((p) => [p.id, mapQuizPosition(p.position)]));

  const byPosMetric = Object.fromEntries(POSITIONS.map((pos) => [pos, Object.fromEntries(METRICS.map((m) => [m, []]))]));

  const playerAgg = new Map();
  for (const row of stats) {
    if (row.context !== "CLUB") continue;
    const pos = posById.get(row.playerId);
    if (!pos) continue;
    const cur = playerAgg.get(row.playerId) ?? {
      pos,
      apps: 0,
      goals: 0,
      assists: 0,
      minutes: 0,
      penaltyGoals: 0,
      cleanSheets: 0,
      yellowCards: 0,
      redCards: 0,
      goalsConceded: 0,
    };
    cur.apps += row.appearances ?? 0;
    cur.goals += row.goals ?? 0;
    cur.assists += row.assists ?? 0;
    cur.minutes += row.minutes ?? 0;
    cur.penaltyGoals += row.penaltyGoals ?? 0;
    cur.cleanSheets += row.cleanSheets ?? 0;
    cur.yellowCards += row.yellowCards ?? 0;
    cur.redCards += row.redCards ?? 0;
    cur.goalsConceded += row.goalsConceded ?? 0;
    playerAgg.set(row.playerId, cur);
  }

  for (const agg of playerAgg.values()) {
    if (agg.apps < 15 || agg.minutes < 900) continue;
    const pos = agg.pos;
    const mins = Math.max(agg.minutes, 1);
    const npg = Math.max(0, agg.goals - agg.penaltyGoals);
    const gp90 = (agg.goals / mins) * 90;
    const npxg90 = (npg / mins) * 90;
    const ap90 = (agg.assists / mins) * 90;
    byPosMetric[pos].npxg_per_90.push(npxg90);
    byPosMetric[pos].goals_per_90.push(gp90);
    byPosMetric[pos].assists_per_90.push(ap90);
    byPosMetric[pos].goal_involvement_per_90.push(gp90 + ap90);
    byPosMetric[pos].minutes_per_app.push(agg.minutes / agg.apps);
    if (agg.cleanSheets > 0) byPosMetric[pos].clean_sheet_rate.push(agg.cleanSheets / agg.apps);
    if (agg.goalsConceded > 0) byPosMetric[pos].goals_conceded_per_90.push((agg.goalsConceded / mins) * 90);
    const cards90 = ((agg.yellowCards + agg.redCards * 2) / mins) * 90;
    if (cards90 > 0) byPosMetric[pos].discipline_per_90.push(cards90);
  }

  const out = {};
  for (const pos of POSITIONS) {
    out[pos] = {};
    for (const metric of METRICS) {
      const bp = breakpoints(byPosMetric[pos][metric]);
      if (bp) out[pos][metric] = bp;
    }
  }

  writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(`✓ position-percentiles.json written (${Object.keys(out).length} positions)`);
}

main();
