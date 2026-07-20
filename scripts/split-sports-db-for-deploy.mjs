#!/usr/bin/env node
/**
 * Split large sports-db JSON arrays into <8MB chunks for Netlify static deploy
 * (Netlify recommends ≤10MB per file; season-stats.json is ~320MB uncompressed).
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Stay under Netlify's ~10MB per-file guidance. */
export const MAX_CHUNK_BYTES = 8_000_000;

export const CHUNKED_FILES = ["season-stats.json", "players-extended.json"];

/**
 * @param {string} dataDir
 * @param {{ maxChunkBytes?: number, files?: string[] }} [options]
 */
export function splitSportsDbForDeploy(dataDir, options = {}) {
  const maxChunkBytes = options.maxChunkBytes ?? MAX_CHUNK_BYTES;
  const files = options.files ?? CHUNKED_FILES;
  const force = options.force === true;
  const requireFiles = options.requireFiles ?? ["season-stats.json"];
  const chunksRoot = join(dataDir, "chunks");
  mkdirSync(chunksRoot, { recursive: true });

  const results = [];

  for (const fileName of files) {
    const sourcePath = join(dataDir, fileName);
    if (!existsSync(sourcePath)) {
      if (requireFiles.includes(fileName)) {
        throw new Error(
          `${fileName} missing in ${dataDir} — run prebuild:data or download the sports-db release bundle first`,
        );
      }
      continue;
    }

    const baseName = fileName.replace(/\.json$/i, "");
    const manifestPath = join(chunksRoot, `${baseName}.manifest.json`);

    if (!force && existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      if (manifest.totalItems && existsSync(join(chunksRoot, baseName, "000.json"))) {
        results.push({ fileName, chunked: true, skipped: true, chunkCount: manifest.chunkCount });
        continue;
      }
    }

    const size = statSync(sourcePath).size;
    if (size <= maxChunkBytes) {
      results.push({ fileName, chunked: false, bytes: size });
      continue;
    }

    const chunkDir = join(chunksRoot, baseName);
    rmSync(chunkDir, { recursive: true, force: true });
    mkdirSync(chunkDir, { recursive: true });

    console.log(`→ Splitting ${fileName} (${(size / 1024 / 1024).toFixed(1)} MB)…`);
    const items = JSON.parse(readFileSync(sourcePath, "utf8"));
    if (!Array.isArray(items)) {
      throw new Error(`${fileName} is not a JSON array — cannot chunk`);
    }

    const chunkFiles = [];
    let batch = [];
    let batchBytes = 2;

    function flushBatch() {
      if (!batch.length) return;
      const idx = chunkFiles.length;
      const chunkName = `${String(idx).padStart(3, "0")}.json`;
      const chunkPath = join(chunkDir, chunkName);
      const payload = JSON.stringify(batch);
      writeFileSync(chunkPath, payload);
      chunkFiles.push(chunkName);
      batch = [];
      batchBytes = 2;
    }

    for (const item of items) {
      const itemBytes = Buffer.byteLength(JSON.stringify(item), "utf8") + 1;
      if (batch.length && batchBytes + itemBytes > maxChunkBytes) {
        flushBatch();
      }
      batch.push(item);
      batchBytes += itemBytes;
    }
    flushBatch();

    const manifest = {
      source: fileName,
      chunkCount: chunkFiles.length,
      totalItems: items.length,
      maxChunkBytes,
    };
    writeFileSync(join(chunksRoot, `${baseName}.manifest.json`), JSON.stringify(manifest));

    const largestChunk = Math.max(
      ...readdirSync(chunkDir).map((name) => statSync(join(chunkDir, name)).size),
    );
    console.log(
      `  ✓ ${baseName}: ${chunkFiles.length} chunks (largest ${(largestChunk / 1024 / 1024).toFixed(2)} MB, ${items.length} rows)`,
    );
    results.push({ fileName, chunked: true, bytes: size, chunkCount: chunkFiles.length });
  }

  return results;
}

/** @returns {Set<string>} filenames skipped when chunk manifests exist. */
export function getChunkedBasenames(dataDir) {
  const chunked = new Set();
  const chunksRoot = join(dataDir, "chunks");
  if (!existsSync(chunksRoot)) return chunked;
  for (const fileName of CHUNKED_FILES) {
    const baseName = fileName.replace(/\.json$/i, "");
    if (existsSync(join(chunksRoot, `${baseName}.manifest.json`))) {
      chunked.add(fileName);
    }
  }
  return chunked;
}

/** Split large arrays if needed, then copy deploy-safe files to dest. */
export function copySportsDbDataForDeploy(src, dest, options = {}) {
  if (!existsSync(src)) return { copied: 0, chunked: [] };

  if (options.split !== false && options.skipSplit !== true) {
    splitSportsDbForDeploy(src);
  }
  mkdirSync(dest, { recursive: true });

  const skipMonoliths = getChunkedBasenames(src);
  let copied = 0;
  for (const file of readdirSync(src)) {
    if (!file.endsWith(".json")) continue;
    if (skipMonoliths.has(file)) continue;
    const filePath = join(src, file);
    const size = statSync(filePath).size;
    if (size > MAX_CHUNK_BYTES) {
      console.warn(
        `  ⚠ Skipping ${file} (${(size / 1024 / 1024).toFixed(1)} MB) — chunks required for Netlify deploy`,
      );
      continue;
    }
    cpSync(filePath, join(dest, file));
    copied += 1;
  }

  const chunksSrc = join(src, "chunks");
  if (existsSync(chunksSrc)) {
    cpSync(chunksSrc, join(dest, "chunks"), { recursive: true });
  }

  const destStats = join(dest, "season-stats.json");
  if (!existsSync(destStats) && !existsSync(join(dest, "chunks", "season-stats.manifest.json"))) {
    const fixture = join(src, "season-stats.fixture.json");
    if (existsSync(fixture)) {
      cpSync(fixture, destStats);
      copied += 1;
      console.warn("  Using season-stats.fixture.json for embedded dev build");
    }
  }

  return { copied, chunked: [...skipMonoliths] };
}

/** @param {string} dataDir */
export function verifyChunkManifests(dataDir) {
  const chunksRoot = join(dataDir, "chunks");

  for (const fileName of CHUNKED_FILES) {
    const sourcePath = join(dataDir, fileName);
    if (!existsSync(sourcePath)) {
      if (fileName === "season-stats.json") {
        throw new Error(`${fileName} missing in ${dataDir} — prebuild:data failed`);
      }
      continue;
    }

    const size = statSync(sourcePath).size;
    if (size <= MAX_CHUNK_BYTES) continue;

    const baseName = fileName.replace(/\.json$/i, "");
    const manifestPath = join(chunksRoot, `${baseName}.manifest.json`);
    if (!existsSync(manifestPath)) {
      const listing = existsSync(chunksRoot) ? readdirSync(chunksRoot).join(", ") : "(no chunks dir)";
      throw new Error(
        `${baseName}.manifest.json missing in ${chunksRoot} — split step did not run (source ${(size / 1024 / 1024).toFixed(1)} MB). Found: ${listing}`,
      );
    }
  }
}

const isMain = process.argv[1]?.endsWith("split-sports-db-for-deploy.mjs");
if (isMain) {
  const dataDir = process.argv[2];
  if (!dataDir) {
    console.error("Usage: node scripts/split-sports-db-for-deploy.mjs <dataDir>");
    process.exit(1);
  }
  splitSportsDbForDeploy(dataDir);
}
