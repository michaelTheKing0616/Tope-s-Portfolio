/** Benchmark pool compute — target p95 < 400ms (Phase 6b). */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { __setExtendedDataForTests } from "@sportverse/sports-db";
import { setAwardsData } from "@sportverse/rating-engine";
import { buildDraftPool, PRESET_MODES } from "@sportverse/draftballer-core";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = resolve(__dirname, "../packages/sports-db/data");

function loadJson(name: string) {
  return JSON.parse(readFileSync(resolve(DATA, name), "utf8"));
}

__setExtendedDataForTests({
  players: loadJson("players-extended.json"),
  stats: loadJson("season-stats.json"),
  competitions: loadJson("competitions.json"),
  clubs: loadJson("clubs-extended.json"),
  eras: loadJson("era-baselines.json"),
  awards: loadJson("awards.json"),
  moments: loadJson("iconic_moments.json"),
});

setAwardsData(loadJson("awards.json"), loadJson("iconic_moments.json"));

const modeIds = ["all-time-any", "premier-league", "continental-cl", "decade-2010s"];
const samples: number[] = [];

for (const id of modeIds) {
  const mode = PRESET_MODES.find((m) => m.id === id);
  if (!mode) continue;
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    const pool = buildDraftPool(mode);
    samples.push(performance.now() - t0);
    if (i === 0) console.log(`${id}: ${pool.length} players, top OVR ${pool[0]?.ovr ?? "—"}`);
  }
}

samples.sort((a, b) => a - b);
const p95 = samples[Math.floor(samples.length * 0.95)] ?? samples[samples.length - 1]!;
const avg = samples.reduce((a, b) => a + b, 0) / samples.length;

console.log("\nPool benchmark:", {
  runs: samples.length,
  avgMs: Math.round(avg),
  p95Ms: Math.round(p95),
  pass: p95 < 400,
});

process.exit(p95 < 400 ? 0 : 1);
