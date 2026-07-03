#!/usr/bin/env node
/**
 * Netlify / CI prebuild: seed DRAFTBALLER data, install SPORTVERSE deps, verify artifacts.
 * Archive CSVs are local-only (gitignored); this uses football-datasets + Transfermarkt CDN.
 */
import { execSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runSeedPipeline } from "./seed-external-data.mjs";
import { downloadSportsDbBundle } from "./download-sports-db-bundle.mjs";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const dataDir = join(root, "sportverse/packages/sports-db/data");
const sportverseRoot = join(root, "sportverse");

const REQUIRED_FILES = [
  { name: "players-extended.json", minBytes: 500_000 },
  { name: "season-stats.json", minBytes: 1_000_000 },
  { name: "competitions.json", minBytes: 100 },
  { name: "clubs-extended.json", minBytes: 1000 },
  { name: "era-baselines.json", minBytes: 100 },
  { name: "engine-calibration.json", minBytes: 100 },
  { name: "league-strength-index.json", minBytes: 100 },
  { name: "player-transfers.json", minBytes: 1000 },
  { name: "cross-league-fixtures.json", minBytes: 100 },
  { name: "awards.json", minBytes: 10 },
  { name: "legacy-reputation.json", minBytes: 10 },
  { name: "partnership-pairs.json", minBytes: 10 },
];

function verifyDataArtifacts() {
  console.log("\n→ Verifying sports-db data artifacts…");
  for (const { name, minBytes } of REQUIRED_FILES) {
    const path = join(dataDir, name);
    if (!existsSync(path)) {
      throw new Error(`Missing required data file: ${name} (expected at ${path})`);
    }
    const size = statSync(path).size;
    if (size < minBytes) {
      throw new Error(`${name} is too small (${size} bytes) — ETL may have failed`);
    }
    console.log(`  ✓ ${name} (${(size / 1024 / 1024).toFixed(2)} MB)`);
  }
}

function installSportverse() {
  console.log("\n→ Installing SPORTVERSE workspace dependencies…");
  execSync("npm install", { cwd: sportverseRoot, stdio: "inherit", shell: true });
}

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log(" DRAFTBALLER / SPORTVERSE — Netlify prebuild");
  console.log("═══════════════════════════════════════════════════════");

  if (process.env.SKIP_DATA_SEED === "1") {
    console.log("SKIP_DATA_SEED=1 — skipping data download/ETL");
  } else {
    const fromRelease = await downloadSportsDbBundle({ optional: true });
    if (!fromRelease) {
      await runSeedPipeline({
        cloneFootballDatasets: true,
        buildJson: true,
        tmCdnFallback: true,
        importSql: false,
      });
    }
  }

  verifyDataArtifacts();
  installSportverse();

  console.log("\n✓ Netlify prebuild complete — ready for build:games\n");
}

main().catch((err) => {
  console.error("\n✗ Netlify prebuild failed:", err.message ?? err);
  process.exit(1);
});
