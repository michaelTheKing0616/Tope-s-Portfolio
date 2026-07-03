#!/usr/bin/env node
/**
 * Copy chunked sports-db JSON into dist/play/sportverse/data after astro build.
 * Astro may not publish everything under gitignored public/play; this guarantees Netlify gets chunks.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { copySportsDbDataForDeploy } from "./split-sports-db-for-deploy.mjs";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const dataSrc = join(root, "sportverse/packages/sports-db/data");
const gameRoot = join(root, "dist/play/sportverse");
const dataDest = join(gameRoot, "data");

function verifyDistData() {
  const manifest = join(dataDest, "chunks/season-stats.manifest.json");
  if (!existsSync(manifest)) {
    throw new Error(
      "dist/play/sportverse/data/chunks/season-stats.manifest.json missing — chunk deploy failed",
    );
  }
  const chunkDir = join(dataDest, "chunks/season-stats");
  const chunkCount = readdirSync(chunkDir).filter((f) => f.endsWith(".json")).length;
  if (chunkCount < 1) {
    throw new Error("No season-stats chunks in dist — chunk deploy failed");
  }
  const largest = Math.max(...readdirSync(chunkDir).map((f) => statSync(join(chunkDir, f)).size));
  if (largest > 10_000_000) {
    throw new Error(
      `Largest season-stats chunk is ${(largest / 1024 / 1024).toFixed(2)} MB — exceeds Netlify ~10MB guidance`,
    );
  }
  console.log(`  ✓ dist data verified (${chunkCount} season-stats chunks, largest ${(largest / 1024 / 1024).toFixed(2)} MB)`);
}

function main() {
  if (!existsSync(gameRoot)) {
    throw new Error("dist/play/sportverse missing — run build:games before astro build");
  }
  if (!existsSync(dataSrc)) {
    throw new Error("sportverse/packages/sports-db/data missing — run prebuild:data first");
  }

  console.log("\n→ Staging SPORTVERSE data into dist/ for Netlify…");
  const { copied, chunked } = copySportsDbDataForDeploy(dataSrc, dataDest, { split: false });
  if (chunked.length) {
    console.log(`  Chunked datasets: ${chunked.join(", ")}`);
  }
  console.log(`  Staged ${copied} JSON files + chunks/ → dist/play/sportverse/data/`);
  verifyDistData();
  console.log("✓ dist/play/sportverse/data ready for Netlify publish\n");
}

main();
