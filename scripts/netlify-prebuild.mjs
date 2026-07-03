#!/usr/bin/env node
/**
 * Netlify / CI prebuild: seed DRAFTBALLER data, install SPORTVERSE deps, verify artifacts.
 * Archive CSVs are local-only (gitignored); this uses football-datasets + Transfermarkt CDN.
 */
import { execSync } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runSeedPipeline } from "./seed-external-data.mjs";
import { downloadSportsDbBundle } from "./download-sports-db-bundle.mjs";
import { verifySportsDbArtifacts } from "./verify-sports-db-artifacts.mjs";
import { splitSportsDbForDeploy } from "./split-sports-db-for-deploy.mjs";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const sportverseRoot = join(root, "sportverse");
const dataDir = join(sportverseRoot, "packages", "sports-db", "data");

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

  verifySportsDbArtifacts();
  installSportverse();

  console.log("\n→ Splitting large JSON for Netlify deploy (once)…");
  splitSportsDbForDeploy(dataDir);

  console.log("\n✓ Netlify prebuild complete — ready for build:games\n");
}

main().catch((err) => {
  console.error("\n✗ Netlify prebuild failed:", err.message ?? err);
  process.exit(1);
});
