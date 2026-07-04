#!/usr/bin/env node
/**
 * Generate gzip sports-db chunks into public/api/sports-db/ for static same-origin CDN.
 * Netlify publishes public/ → dist/ so /api/sports-db/* is served without a function proxy.
 */
import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureSportsDbData, dataDir as defaultDataDir } from "./ensure-sports-db-data.mjs";
import { buildSportsDbGzipCdn, MAX_GZIP_BYTES } from "./sports-db-gzip-chunks.mjs";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const cdnPublicDir = join(root, "public/api/sports-db");

export function verifySportsDbCdnDir(cdnDir) {
  for (const baseName of ["season-stats", "players-extended"]) {
    const manifestPath = join(cdnDir, `${baseName}.chunks.json`);
    if (!existsSync(manifestPath)) {
      throw new Error(`Missing ${manifestPath} — sports-db CDN staging failed`);
    }
    const gzFiles = readdirSync(cdnDir).filter((f) => f.startsWith(`${baseName}-`) && f.endsWith(".json.gz"));
    if (!gzFiles.length) {
      throw new Error(`No gzip chunks for ${baseName} in ${cdnDir}`);
    }
    const largest = Math.max(...gzFiles.map((f) => statSync(join(cdnDir, f)).size));
    if (largest > MAX_GZIP_BYTES) {
      throw new Error(
        `Largest ${baseName} chunk is ${(largest / 1024 / 1024).toFixed(2)} MB — exceeds ${(MAX_GZIP_BYTES / 1024 / 1024).toFixed(0)} MB limit`,
      );
    }
  }
}

async function main() {
  if (!process.env.VITE_SPORTS_DB_CDN) {
    console.log("→ Skipping sports-db CDN staging (VITE_SPORTS_DB_CDN not set)");
    return;
  }

  console.log(`\n→ Staging sports-db gzip CDN → public/api/sports-db/ (${process.env.VITE_SPORTS_DB_CDN})…`);
  await ensureSportsDbData({ skipInstall: true });

  buildSportsDbGzipCdn(defaultDataDir, cdnPublicDir);
  verifySportsDbCdnDir(cdnPublicDir);

  // Netlify reads _headers only from publish root — avoid application/gzip auto MIME on chunks.
  writeFileSync(
    join(root, "public/_headers"),
    "/api/sports-db/*.json.gz\n  Content-Type: application/octet-stream\n  Cache-Control: public, max-age=3600\n\n/api/sports-db/*.chunks.json\n  Content-Type: application/json; charset=utf-8\n  Cache-Control: public, max-age=3600\n",
  );

  const files = readdirSync(cdnPublicDir);
  const totalMb = (files.reduce((sum, f) => sum + statSync(join(cdnPublicDir, f)).size, 0) / 1024 / 1024).toFixed(1);
  console.log(`✓ ${files.length} CDN files staged (${totalMb} MB gzip total) → dist/api/sports-db/ after astro build\n`);
}

const isMain = process.argv[1]?.endsWith("stage-sports-db-cdn.mjs");
if (isMain) {
  main().catch((err) => {
    console.error("\n✗ CDN staging failed:", err.message ?? err);
    process.exit(1);
  });
}

export { cdnPublicDir };
