/**
 * Shared gzip chunk writer for sports-db large JSON arrays.
 * Used by CI (GitHub Release) and Netlify build (static /api/sports-db/).
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

/** Netlify function / static file guidance — keep gzip chunks below ~5MB. */
export const MAX_GZIP_BYTES = 5_000_000;

/** Per-file raw batch targets (players-extended ~5:1, season-stats ~20:1 gzip ratio). */
export const TARGET_RAW_BYTES_BY_FILE = {
  "season-stats.json": 80_000_000,
  "players-extended.json": 15_000_000,
};
export const DEFAULT_TARGET_RAW_BYTES = 20_000_000;

export const CDN_CHUNKED_FILES = ["season-stats.json", "players-extended.json"];

/**
 * @param {string} baseName
 * @param {string} jsonPath
 * @param {string} outDir
 * @param {number} targetRawBytes
 */
export function writeGzipChunks(baseName, jsonPath, outDir, targetRawBytes) {
  const items = JSON.parse(readFileSync(jsonPath, "utf8"));
  if (!Array.isArray(items)) {
    throw new Error(`${jsonPath} is not a JSON array`);
  }

  const chunkFiles = [];
  let batch = [];
  let batchBytes = 2;

  function writeItems(batchItems) {
    if (!batchItems.length) return;
    const gz = gzipSync(JSON.stringify(batchItems), { level: 9 });
    if (gz.length > MAX_GZIP_BYTES) {
      if (batchItems.length === 1) {
        throw new Error(
          `${baseName} single record gzips to ${(gz.length / 1024 / 1024).toFixed(2)} MB — exceeds ${(MAX_GZIP_BYTES / 1024 / 1024).toFixed(0)} MB limit`,
        );
      }
      const mid = Math.ceil(batchItems.length / 2);
      writeItems(batchItems.slice(0, mid));
      writeItems(batchItems.slice(mid));
      return;
    }
    const name = `${baseName}-${String(chunkFiles.length).padStart(3, "0")}.json.gz`;
    writeFileSync(join(outDir, name), gz);
    chunkFiles.push(name);
  }

  function flushBatch() {
    if (!batch.length) return;
    writeItems(batch);
    batch = [];
    batchBytes = 2;
  }

  for (const item of items) {
    const itemBytes = Buffer.byteLength(JSON.stringify(item), "utf8") + 1;
    if (batch.length && batchBytes + itemBytes > targetRawBytes) {
      flushBatch();
    }
    batch.push(item);
    batchBytes += itemBytes;
  }
  flushBatch();

  writeFileSync(
    join(outDir, `${baseName}.chunks.json`),
    JSON.stringify({ source: `${baseName}.json`, files: chunkFiles, totalItems: items.length }, null, 2),
  );

  const largest = Math.max(...chunkFiles.map((f) => statSync(join(outDir, f)).size));
  return { chunkCount: chunkFiles.length, largestBytes: largest, totalItems: items.length };
}

/**
 * Build gzip chunk manifests + files for browser CDN loading.
 * @param {string} dataDir
 * @param {string} outDir
 * @param {{ files?: string[] }} [options]
 */
export function buildSportsDbGzipCdn(dataDir, outDir, options = {}) {
  const files = options.files ?? CDN_CHUNKED_FILES;
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const results = [];
  for (const name of files) {
    const src = join(dataDir, name);
    if (!existsSync(src)) continue;
    const baseName = name.replace(/\.json$/i, "");
    const targetRawBytes = TARGET_RAW_BYTES_BY_FILE[name] ?? DEFAULT_TARGET_RAW_BYTES;
    const stats = writeGzipChunks(baseName, src, outDir, targetRawBytes);
    console.log(
      `  ✓ ${baseName}: ${stats.chunkCount} gzip chunks (largest ${(stats.largestBytes / 1024 / 1024).toFixed(2)} MB, ${stats.totalItems} rows)`,
    );
    results.push({ baseName, ...stats });
  }

  for (const name of files) {
    const baseName = name.replace(/\.json$/i, "");
    const manifestPath = join(outDir, `${baseName}.chunks.json`);
    if (!existsSync(manifestPath)) {
      throw new Error(`Missing ${manifestPath} — gzip CDN build failed for ${baseName}`);
    }
    const chunkCount = readdirSync(outDir).filter((f) => f.startsWith(`${baseName}-`) && f.endsWith(".json.gz")).length;
    if (chunkCount === 0) {
      throw new Error(`No gzip chunks written for ${baseName}`);
    }
  }

  return results;
}
