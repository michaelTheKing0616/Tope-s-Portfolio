#!/usr/bin/env node
/**
 * Netlify / CI prebuild: seed DRAFTBALLER data, install SPORTVERSE deps, split for deploy.
 */
import { ensureSportsDbData, dataDir } from "./ensure-sports-db-data.mjs";
import { splitSportsDbForDeploy, verifyChunkManifests } from "./split-sports-db-for-deploy.mjs";

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log(" DRAFTBALLER / SPORTVERSE — Netlify prebuild");
  console.log("═══════════════════════════════════════════════════════");

  await ensureSportsDbData();

  console.log("\n→ Splitting large JSON for Netlify deploy (once)…");
  splitSportsDbForDeploy(dataDir);
  verifyChunkManifests(dataDir);

  console.log("\n✓ Netlify prebuild complete — ready for build:games\n");
}

main().catch((err) => {
  console.error("\n✗ Netlify prebuild failed:", err.message ?? err);
  process.exit(1);
});
