#!/usr/bin/env node
/**
 * Ensure sportverse/packages/sports-db/data exists with required JSON (Netlify + local).
 * season-stats.json is gitignored — always fetched from GitHub Release or built via ETL.
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { downloadSportsDbBundle } from "./download-sports-db-bundle.mjs";
import { runSeedPipeline } from "./seed-external-data.mjs";
import { verifySportsDbArtifacts } from "./verify-sports-db-artifacts.mjs";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const sportverseRoot = join(root, "sportverse");
export const dataDir = join(sportverseRoot, "packages", "sports-db", "data");

const MIN_SEASON_STATS_BYTES = 1_000_000;

function hasSeasonStats() {
  const path = join(dataDir, "season-stats.json");
  return existsSync(path) && statSync(path).size >= MIN_SEASON_STATS_BYTES;
}

function installSportverse() {
  if (existsSync(join(sportverseRoot, "node_modules"))) return;
  console.log("\n→ Installing SPORTVERSE workspace dependencies…");
  execSync("npm install", { cwd: sportverseRoot, stdio: "inherit", shell: true });
}

/**
 * Download or ETL sports-db JSON until season-stats.json is present.
 * @param {{ skipInstall?: boolean }} [opts]
 */
export async function ensureSportsDbData(opts = {}) {
  mkdirSync(dataDir, { recursive: true });

  if (hasSeasonStats()) {
    const mb = (statSync(join(dataDir, "season-stats.json")).size / 1024 / 1024).toFixed(1);
    console.log(`✓ sports-db data present (season-stats ${mb} MB)`);
    verifySportsDbArtifacts();
    if (!opts.skipInstall) installSportverse();
    return;
  }

  console.log("\n→ sports-db data missing — fetching release bundle or running ETL…");

  if (process.env.SKIP_DATA_SEED === "1") {
    throw new Error(
      "SKIP_DATA_SEED=1 but season-stats.json is missing. Unset SKIP_DATA_SEED or run GitHub Actions build-sports-db first.",
    );
  }

  const onNetlify = process.env.NETLIFY === "true";
  const fromRelease = await downloadSportsDbBundle({ optional: !onNetlify });

  if (!fromRelease) {
    if (onNetlify) {
      throw new Error(
        "Sports-db release bundle download failed on Netlify. Run the GitHub Actions workflow " +
          "'Build SPORTVERSE database' and confirm release sports-db-latest exists, or set SPORTS_DB_BUNDLE_URL.",
      );
    }
    console.log("→ Release unavailable — running ETL (slow)…");
    await runSeedPipeline({
      cloneFootballDatasets: true,
      buildJson: true,
      tmCdnFallback: true,
      importSql: false,
    });
  }

  if (!hasSeasonStats()) {
    throw new Error(`season-stats.json still missing after fetch/ETL — check ${dataDir}`);
  }

  verifySportsDbArtifacts();
  if (!opts.skipInstall) installSportverse();
}

const isMain = process.argv[1]?.endsWith("ensure-sports-db-data.mjs");
if (isMain) {
  ensureSportsDbData().catch((err) => {
    console.error("\n✗", err.message ?? err);
    process.exit(1);
  });
}
