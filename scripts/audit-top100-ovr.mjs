#!/usr/bin/env node
/**
 * Print top-100 OVR for all-time-any — Phase 4 GOAT smoke list.
 * Usage: cd sportverse && npx tsx ../scripts/audit-top100-ovr.mjs
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = resolve(root, "sportverse/packages/sports-db/data");

function load(name) {
  const p = resolve(dataDir, name);
  if (!existsSync(p)) return [];
  return JSON.parse(readFileSync(p, "utf8"));
}

async function main() {
  const { __setExtendedDataForTests } = await import("../sportverse/packages/sports-db/src/extended.ts");
  const {
    attachMvPercentilesFromPeakMv,
    setAwardsData,
    setFameDataForRatings,
  } = await import("../sportverse/packages/rating-engine/src/index.ts");
  const { buildDraftPool, getPresetMode, setLegendRatings } = await import(
    "../sportverse/packages/draftballer-core/src/index.ts"
  );

  const fame = load("fame-index.json");
  const statsPrimary = resolve(dataDir, "season-stats.json");
  const stats = existsSync(statsPrimary)
    ? JSON.parse(readFileSync(statsPrimary, "utf8"))
    : load("season-stats.fixture.json");

  __setExtendedDataForTests({
    players: load("players-extended.json"),
    stats,
    competitions: load("competitions.json"),
    clubs: load("clubs-extended.json"),
    eras: load("era-baselines.json"),
    awards: load("awards.json"),
    moments: load("iconic_moments.json"),
    fameIndex: fame,
  });
  setAwardsData(load("awards.json"), load("iconic_moments.json"));
  setFameDataForRatings(attachMvPercentilesFromPeakMv(fame));
  setLegendRatings(load("legend-ratings.json"));

  const pool = buildDraftPool(getPresetMode("all-time-any"));
  const top = pool.slice(0, 100);
  const lines = top.map(
    (c, i) => `${String(i + 1).padStart(3)}. ${c.ovr} ${c.position.padEnd(2)} ${c.name}`,
  );
  const out = [
    "# Top-100 OVR — all-time-any",
    `Generated: ${new Date().toISOString()}`,
    `Pool size: ${pool.length}`,
    "",
    ...lines,
  ].join("\n");
  console.log(out);
  writeFileSync(resolve(root, "BUILD_LOG_TOP100.txt"), `${out}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
