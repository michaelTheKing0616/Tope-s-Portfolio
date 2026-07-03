#!/usr/bin/env node
/**
 * Copy chunked sports-db JSON into dist/play/sportverse/data after astro build.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureSportsDbData, dataDir as dataSrc } from "./ensure-sports-db-data.mjs";
import {
  copySportsDbDataForDeploy,
  MAX_CHUNK_BYTES,
  splitSportsDbForDeploy,
  verifyChunkManifests,
} from "./split-sports-db-for-deploy.mjs";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const gameRoot = join(root, "dist/play/sportverse");
const dataDest = join(gameRoot, "data");

function logDir(label, dir) {
  if (!existsSync(dir)) {
    console.log(`  ${label}: (missing)`);
    return;
  }
  console.log(`  ${label}: ${readdirSync(dir).join(", ")}`);
}

function verifyDistData() {
  if (process.env.VITE_SPORTS_DB_CDN) {
    console.log(
      `  ✓ CDN mode (VITE_SPORTS_DB_CDN) — large JSON loaded from GitHub Release in browser`,
    );
    return;
  }

  verifyChunkManifests(dataDest);

  const statsManifest = join(dataDest, "chunks/season-stats.manifest.json");
  if (!existsSync(statsManifest)) {
    const statsPath = join(dataDest, "season-stats.json");
    if (existsSync(statsPath) && statSync(statsPath).size <= MAX_CHUNK_BYTES) {
      console.log("  ✓ dist data verified (season-stats monolith ≤8MB, no chunks needed)");
      return;
    }
  }

  const chunkDir = join(dataDest, "chunks/season-stats");
  const chunkCount = readdirSync(chunkDir).filter((f) => f.endsWith(".json")).length;
  const largest = Math.max(...readdirSync(chunkDir).map((f) => statSync(join(chunkDir, f)).size));
  if (largest > 10_000_000) {
    throw new Error(
      `Largest season-stats chunk is ${(largest / 1024 / 1024).toFixed(2)} MB — exceeds Netlify ~10MB guidance`,
    );
  }
  console.log(
    `  ✓ dist data verified (${chunkCount} season-stats chunks, largest ${(largest / 1024 / 1024).toFixed(2)} MB)`,
  );
}

async function main() {
  if (!existsSync(gameRoot)) {
    throw new Error("dist/play/sportverse missing — run build:games before astro build");
  }

  console.log("\n→ Staging SPORTVERSE data into dist/ for Netlify…");
  await ensureSportsDbData({ skipInstall: true });

  const statsPath = join(dataSrc, "season-stats.json");
  console.log(
    `  source season-stats.json: ${(statSync(statsPath).size / 1024 / 1024).toFixed(1)} MB`,
  );

  console.log("→ Splitting large JSON (if not already chunked)…");
  if (!process.env.VITE_SPORTS_DB_CDN) {
    splitSportsDbForDeploy(dataSrc);
    verifyChunkManifests(dataSrc);
  } else {
    console.log("  Skipping split — large files served from GitHub Release CDN");
  }

  const { copied, chunked } = copySportsDbDataForDeploy(dataSrc, dataDest, { split: false });
  if (chunked.length) {
    console.log(`  Chunked datasets: ${chunked.join(", ")}`);
  }
  console.log(`  Staged ${copied} JSON files + chunks/ → dist/play/sportverse/data/`);

  logDir("dist chunks", join(dataDest, "chunks"));
  verifyDistData();
  console.log("✓ dist/play/sportverse/data ready for Netlify publish\n");
}

main().catch((err) => {
  console.error("\n✗ Stage failed:", err.message ?? err);
  process.exit(1);
});
