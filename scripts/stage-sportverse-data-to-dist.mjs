#!/usr/bin/env node
/**
 * Copy chunked sports-db JSON into dist/play/sportverse/data after astro build.
 * Ensures large JSON is split here (single split point) then copied into the Netlify publish dir.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  copySportsDbDataForDeploy,
  MAX_CHUNK_BYTES,
  splitSportsDbForDeploy,
  verifyChunkManifests,
} from "./split-sports-db-for-deploy.mjs";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const dataSrc = join(root, "sportverse/packages/sports-db/data");
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
  verifyChunkManifests(dataDest);

  const statsManifest = join(dataDest, "chunks/season-stats.manifest.json");
  if (!existsSync(statsManifest)) {
    const statsPath = join(dataDest, "season-stats.json");
    if (existsSync(statsPath) && statSync(statsPath).size <= 8_000_000) {
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

function main() {
  if (!existsSync(gameRoot)) {
    throw new Error("dist/play/sportverse missing — run build:games before astro build");
  }
  if (!existsSync(dataSrc)) {
    throw new Error("sportverse/packages/sports-db/data missing — run prebuild:data first");
  }

  const statsPath = join(dataSrc, "season-stats.json");
  if (!existsSync(statsPath)) {
    throw new Error(
      `season-stats.json missing at ${statsPath} — prebuild:data failed or release bundle was not extracted`,
    );
  }
  console.log(
    `  source season-stats.json: ${(statSync(statsPath).size / 1024 / 1024).toFixed(1)} MB`,
  );

  console.log("\n→ Staging SPORTVERSE data into dist/ for Netlify…");
  console.log("→ Splitting large JSON (if not already chunked)…");
  splitSportsDbForDeploy(dataSrc);
  verifyChunkManifests(dataSrc);

  const { copied, chunked } = copySportsDbDataForDeploy(dataSrc, dataDest, { split: false });
  if (chunked.length) {
    console.log(`  Chunked datasets: ${chunked.join(", ")}`);
  }
  console.log(`  Staged ${copied} JSON files + chunks/ → dist/play/sportverse/data/`);

  logDir("dist chunks", join(dataDest, "chunks"));
  verifyDistData();
  console.log("✓ dist/play/sportverse/data ready for Netlify publish\n");
}

main();
