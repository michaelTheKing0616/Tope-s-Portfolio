#!/usr/bin/env node
/**
 * ETL: football-datasets + archive (+ optional TM CDN fallback) → sports-db JSON + SQL seed
 */
import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildFromFootballDatasets } from "./etl/build-from-football-datasets.mjs";
import { buildFromTransfermarkt } from "./etl/build-from-transfermarkt.mjs";
import { buildFromArchive } from "./etl/build-from-archive.mjs";
import { buildAllCalibrationData } from "./etl/build-calibration-data.mjs";
import { buildAwardsAndMoments } from "./etl/seed-awards.mjs";
import { loadCuratedPlayers, OUT_DIR, RAW_DIR, ARCHIVE_DIR } from "./etl/utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SQL_OUT = resolve(ROOT, "sportverse/services/api/migrations/seed-data.sql");

const args = new Set(process.argv.slice(2));
const ARCHIVE_PROFILES = resolve(ARCHIVE_DIR, "player_profiles/player_profiles.csv");

function cloneRepos() {
  mkdirSync(RAW_DIR, { recursive: true });
  const fd = resolve(RAW_DIR, "football-datasets");
  if (!existsSync(fd)) {
    console.log("Cloning football-datasets…");
    execSync(`git clone --depth 1 https://github.com/datasets/football-datasets.git "${fd}"`, {
      stdio: "inherit",
      cwd: ROOT,
    });
  } else {
    console.log("football-datasets already present");
  }
  console.log("Primary TM source: sportverse/archive/ (use --tm-cdn-fallback for R2 CDN).");
}

async function buildJson(options = {}) {
  const hasArchive = existsSync(ARCHIVE_PROFILES);
  const useTmCdn =
    !hasArchive &&
    (options.tmCdnFallback === true ||
      args.has("--tm-cdn-fallback") ||
      args.has("--build"));

  const curated = loadCuratedPlayers();
  const footballBase = buildFromFootballDatasets(curated);
  console.log("football-datasets:", footballBase.meta);

  let built = footballBase;
  let archiveMeta = null;

  if (hasArchive) {
    console.log("Ingesting Transfermarkt archive CSVs…");
    built = await buildFromArchive(footballBase, curated);
    archiveMeta = built.meta;
    console.log("archive:", built.meta);
  } else {
    console.warn("Archive not found at", ARCHIVE_DIR, "— skipping archive ETL.");
  }

  if (useTmCdn) {
    try {
      console.log("Fetching Transfermarkt R2 CDN datasets (fallback)…");
      const tm = await buildFromTransfermarkt(built.mergedIds, built.mergedNorms);
      built.playersExtended = built.playersExtended.concat(tm.playersExtended);
      built.seasonStats = built.seasonStats.concat(tm.seasonStats);
      console.log("transfermarkt CDN:", tm.meta);
    } catch (err) {
      console.error("Transfermarkt CDN ETL failed:", err.message);
      if (options.tmCdnFallback || args.has("--tm-cdn-fallback")) process.exit(1);
    }
  }

  const { awards, iconicMoments } = buildAwardsAndMoments(curated);
  mkdirSync(OUT_DIR, { recursive: true });

  let calibration = null;
  if (existsSync(ARCHIVE_PROFILES)) {
    calibration = await buildAllCalibrationData();
    writeFileSync(resolve(OUT_DIR, "player-transfers.json"), JSON.stringify(calibration.transfers, null, 2));
    writeFileSync(resolve(OUT_DIR, "cross-league-fixtures.json"), JSON.stringify(calibration.fixtures, null, 2));
    writeFileSync(resolve(OUT_DIR, "team-season-records.json"), JSON.stringify(calibration.teamSeasonRecords, null, 2));
    console.log("calibration data:", calibration.meta);
  }

  writeFileSync(resolve(OUT_DIR, "players-extended.json"), JSON.stringify(built.playersExtended));
  writeFileSync(resolve(OUT_DIR, "season-stats.json"), JSON.stringify(built.seasonStats));
  writeFileSync(resolve(OUT_DIR, "competitions.json"), JSON.stringify(built.competitions, null, 2));
  writeFileSync(resolve(OUT_DIR, "clubs-extended.json"), JSON.stringify(built.clubsExtended, null, 2));
  writeFileSync(resolve(OUT_DIR, "era-baselines.json"), JSON.stringify(built.eraBaselines, null, 2));
  writeFileSync(resolve(OUT_DIR, "player-aliases.json"), JSON.stringify(built.playerAliases ?? [], null, 2));
  writeFileSync(resolve(OUT_DIR, "awards.json"), JSON.stringify(awards, null, 2));
  writeFileSync(resolve(OUT_DIR, "iconic_moments.json"), JSON.stringify(iconicMoments, null, 2));

  console.log("ETL complete:", {
    ...built.meta,
    archiveMeta,
    awards: awards.length,
    iconicMoments: iconicMoments.length,
    totalPlayers: built.playersExtended.length,
    totalStats: built.seasonStats.length,
  });
  console.log("Wrote JSON to", OUT_DIR);
  return built;
}

/** Programmatic entry for Netlify / CI (always awaits completion). */
export async function runSeedPipeline(options = {}) {
  const {
    cloneFootballDatasets = false,
    buildJson: doBuild = false,
    calibrationOnly = false,
    tmCdnFallback = false,
    importSql = false,
  } = options;

  if (cloneFootballDatasets) cloneRepos();

  if (calibrationOnly) {
    if (!existsSync(ARCHIVE_PROFILES)) {
      throw new Error(`Archive not found at ${ARCHIVE_DIR} — calibration-only requires local CSVs`);
    }
    mkdirSync(OUT_DIR, { recursive: true });
    const calibration = await buildAllCalibrationData();
    writeFileSync(resolve(OUT_DIR, "player-transfers.json"), JSON.stringify(calibration.transfers, null, 2));
    writeFileSync(resolve(OUT_DIR, "cross-league-fixtures.json"), JSON.stringify(calibration.fixtures, null, 2));
    writeFileSync(resolve(OUT_DIR, "team-season-records.json"), JSON.stringify(calibration.teamSeasonRecords, null, 2));
    console.log("Calibration-only ETL complete:", calibration.meta);
    return null;
  }

  if (doBuild) {
    const fdPath = resolve(RAW_DIR, "football-datasets");
    if (!existsSync(fdPath)) {
      console.log("football-datasets missing — cloning now…");
      cloneRepos();
    }
    const built = await buildJson({
      tmCdnFallback: tmCdnFallback || args.has("--tm-cdn-fallback"),
    });
    if (importSql) buildSql(built);
    return built;
  }

  return null;
}

function esc(v) {
  return String(v ?? "").replace(/'/g, "''");
}

function buildSql(built) {
  const lines = [
    "-- Auto-generated by seed-external-data.mjs — do not edit",
    "BEGIN;",
    "DELETE FROM player_season_stats;",
    "DELETE FROM players;",
    "DELETE FROM competitions;",
  ];
  for (const c of built.competitions) {
    lines.push(
      `INSERT INTO competitions (id, name, type, country) VALUES ('${esc(c.id)}','${esc(c.name)}','${esc(c.type)}','${esc(c.country)}');`,
    );
  }
  for (const p of built.playersExtended.slice(0, 50000)) {
    lines.push(
      `INSERT INTO players (id, full_name, primary_position, nationality, confidence) VALUES ('${esc(p.id)}','${esc(p.name)}','${esc(p.position ?? "")}','${esc(p.nationality ?? "")}',${p.confidence ?? 0.7});`,
    );
  }
  for (const s of built.seasonStats.slice(0, 250000)) {
    lines.push(
      `INSERT INTO player_season_stats (player_id, season_label, competition_id, context, appearances, goals, assists, minutes, confidence) VALUES ('${esc(s.playerId)}','${esc(s.seasonLabel)}','${esc(s.competitionId)}','${esc(s.context)}',${s.appearances},${s.goals},${s.assists},${s.minutes},${s.confidence});`,
    );
  }
  lines.push("COMMIT;");
  mkdirSync(dirname(SQL_OUT), { recursive: true });
  writeFileSync(SQL_OUT, lines.join("\n"));
  console.log("Wrote SQL seed:", SQL_OUT);
}

// CLI dispatch must only run when executed directly — this module is also imported
// by ensure-sports-db-data.mjs / stage scripts, and process.exit(0) at module scope
// would silently kill those importers before they do any work.
const isMain = process.argv[1]?.endsWith("seed-external-data.mjs");

if (isMain) {
  if (args.has("--help") || args.size === 0) {
    console.log(`
SPORTVERSE / DRAFTBALLER data seed

  node scripts/seed-external-data.mjs --clone              Clone football-datasets
  node scripts/seed-external-data.mjs --calibration-only   Archive → transfers/fixtures/team-season JSON only
  node scripts/seed-external-data.mjs --build              Build JSON (archive primary + SQL seed)
  node scripts/seed-external-data.mjs --build --import-sql Build + write SQL seed
  node scripts/seed-external-data.mjs --tm-cdn-fallback    Also merge R2 CDN Transfermarkt export
  node scripts/netlify-prebuild.mjs                        Netlify: clone + seed + verify (used by npm run build)

Raw data: sportverse/data/raw/ (gitignored)
Archive:  sportverse/archive/ (local TM CSVs)
Output:   sportverse/packages/sports-db/data/*.json
`);
    process.exit(0);
  }

  if (args.has("--clone")) cloneRepos();

  if (args.has("--calibration-only")) {
    runSeedPipeline({ calibrationOnly: true }).catch((err) => {
      console.error(err);
      process.exit(1);
    });
  } else if (args.has("--build") || args.has("--import-sql")) {
    runSeedPipeline({
      buildJson: true,
      tmCdnFallback: args.has("--tm-cdn-fallback"),
      importSql: args.has("--import-sql"),
    }).catch((err) => {
      console.error(err);
      process.exit(1);
    });
  }
}
