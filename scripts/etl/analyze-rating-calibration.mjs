#!/usr/bin/env node
/**
 * Calibration report: internal ratings vs EA FC 26 vs legend anchors.
 * Usage: cd sportverse && npx tsx ../scripts/etl/analyze-rating-calibration.mjs
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const dataDir = resolve(root, "sportverse/packages/sports-db/data");

function load(name) {
  const p = resolve(dataDir, name);
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : [];
}

async function main() {
  const { __setExtendedDataForTests } = await import(
    "../../sportverse/packages/sports-db/src/extended.ts"
  );
  const {
    attachMvPercentilesFromPeakMv,
    setAwardsData,
    setFameDataForRatings,
    setEaFc26Index,
  } = await import("../../sportverse/packages/rating-engine/src/index.ts");
  const { buildDraftPool, getPresetMode, setLegendRatings } = await import(
    "../../sportverse/packages/draftballer-core/src/index.ts"
  );

  const fame = load("fame-index.json");
  const stats = existsSync(resolve(dataDir, "season-stats.json"))
    ? JSON.parse(readFileSync(resolve(dataDir, "season-stats.json"), "utf8"))
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
  setEaFc26Index(load("ea-fc26-index.json"));

  const eaById = new Map(load("ea-fc26-index.json").map((e) => [e.playerId, e]));
  const legends = new Map(load("legend-ratings.json").map((e) => [e.playerId, e.ovr]));
  const pool = buildDraftPool(getPresetMode("all-time-any"));
  const byName = new Map(pool.map((p) => [p.name, p]));

  const checks = [
    "Raheem Sterling",
    "Mohamed Salah",
    "Kylian Mbappé",
    "Lionel Messi",
    "João Cancelo",
    "Trent Alexander-Arnold",
    "Virgil van Dijk",
    "Erling Haaland",
    "Rodri",
    "Philipp Lahm",
    "Dani Alves",
    "Achraf Hakimi",
    "Joshua Kimmich",
  ];

  const lines = [
    "# Rating calibration report",
    `Generated: ${new Date().toISOString()}`,
    "",
    "| Player | Internal | EA current | Legend | EA in index |",
    "|--------|----------|------------|--------|-------------|",
  ];

  for (const name of checks) {
    const card = byName.get(name);
    const ea = card ? eaById.get(card.playerId) : undefined;
    const legend = card ? legends.get(card.playerId) : undefined;
    lines.push(
      `| ${name} | ${card?.ovr ?? "—"} | ${ea?.ovr ?? "—"} | ${legend ?? "—"} | ${ea ? "yes" : "no"} |`,
    );
  }

  const eaMatched = pool.filter((p) => eaById.has(p.playerId));
  const mae =
    eaMatched.reduce((s, p) => s + Math.abs(p.ovr - eaById.get(p.playerId).ovr), 0) / eaMatched.length;

  lines.push("");
  lines.push(`Pool size: ${pool.length}`);
  lines.push(`EA-index matched in pool: ${eaMatched.length}`);
  lines.push(`Mean |internal − EA current| (EA-matched only): ${mae.toFixed(1)}`);
  lines.push("");
  lines.push("## Three-dataset roles");
  lines.push("");
  lines.push("1. **eafc26_player_ratings/** — primary external calibration (OVR + 6 face stats). Current-season snapshot; blended with internal peak stats for all-time mode.");
  lines.push("2. **cards/** — 17k webp card images keyed by player name; linked via ea-fc26-index.cardImage for UI.");
  lines.push("3. **data/raw/football-datasets/** — historical match/league/world-cup CSVs; enriches season stats for pre-EA legends (not yet wired).");

  const out = lines.join("\n");
  console.log(out);
  writeFileSync(resolve(root, "BUILD_LOG_CALIBRATION.txt"), `${out}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
