#!/usr/bin/env node
/**
 * Netlify / CI prebuild: seed DRAFTBALLER data, install SPORTVERSE deps, split for deploy.
 */
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureSportsDbData, dataDir } from "./ensure-sports-db-data.mjs";
import { splitSportsDbForDeploy, verifyChunkManifests } from "./split-sports-db-for-deploy.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log(" DRAFTBALLER / SPORTVERSE — Netlify prebuild");
  console.log("═══════════════════════════════════════════════════════");

  await ensureSportsDbData();

  try {
    execSync("node scripts/etl/build-historical-ratings-index.mjs", {
      cwd: root,
      stdio: "inherit",
    });
  } catch (err) {
    console.warn("historical-ratings-index build skipped:", err.message ?? err);
  }

  console.log("\n→ Splitting large JSON for Netlify deploy (once)…");
  splitSportsDbForDeploy(dataDir);
  verifyChunkManifests(dataDir);

  console.log("\n✓ Netlify prebuild complete — ready for build:games\n");
}

main().catch((err) => {
  console.error("\n✗ Netlify prebuild failed:", err.message ?? err);
  process.exit(1);
});
