#!/usr/bin/env node
/**
 * Tarball all sports-db JSON for GitHub Release upload (Netlify downloads this bundle).
 * Also writes gzip chunks for browser CDN (via Netlify function proxy — GitHub blocks CORS).
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { gzipSync } from "node:zlib";
import { verifySportsDbArtifacts } from "./verify-sports-db-artifacts.mjs";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const dataDir = join(root, "sportverse/packages/sports-db/data");
const outTar = join(root, "sports-db-data.tar.gz");
const cdnDir = join(root, "sportverse-cdn");

/** Netlify function response limit ~6MB — keep gzip chunks below this. */
const MAX_GZIP_BYTES = 5_000_000;
/** Initial raw batch size before gzip (tuned per file — players-extended compresses ~5:1, season-stats ~20:1). */
const TARGET_RAW_BYTES_BY_FILE = {
  "season-stats.json": 80_000_000,
  "players-extended.json": 15_000_000,
};
const DEFAULT_TARGET_RAW_BYTES = 20_000_000;

const CDN_CHUNKED_FILES = ["season-stats.json", "players-extended.json"];

/**
 * @param {string} baseName
 * @param {string} jsonPath
 * @param {string} outDir
 * @param {number} targetRawBytes
 */
function writeGzipChunks(baseName, jsonPath, outDir, targetRawBytes) {
  const items = JSON.parse(readFileSync(jsonPath, "utf8"));
  if (!Array.isArray(items)) {
    throw new Error(`${jsonPath} is not a JSON array`);
  }

  const chunkFiles = [];
  let batch = [];
  let batchBytes = 2;

  /** Write one chunk; split batch in half if gzip still exceeds Netlify limit. */
  function writeItems(batchItems) {
    if (!batchItems.length) return;
    const gz = gzipSync(JSON.stringify(batchItems), { level: 9 });
    if (gz.length > MAX_GZIP_BYTES) {
      if (batchItems.length === 1) {
        throw new Error(
          `${baseName} single record gzips to ${(gz.length / 1024 / 1024).toFixed(2)} MB — exceeds Netlify ${(MAX_GZIP_BYTES / 1024 / 1024).toFixed(0)} MB limit`,
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
  console.log(
    `  ✓ ${baseName}: ${chunkFiles.length} gzip chunks (largest ${(largest / 1024 / 1024).toFixed(2)} MB, ${items.length} rows)`,
  );
}

async function main() {
  verifySportsDbArtifacts();

  const files = readdirSync(dataDir).filter((f) => f.endsWith(".json"));
  const manifest = {
    builtAt: new Date().toISOString(),
    files: files.map((name) => {
      const path = join(dataDir, name);
      return { name, bytes: statSync(path).size };
    }),
  };
  writeFileSync(join(dataDir, "manifest.json"), JSON.stringify(manifest, null, 2));

  const staging = join(tmpdir(), `sports-db-${Date.now()}`);
  execSync(`mkdir "${staging}"`, { shell: true });
  for (const name of [...files, "manifest.json"]) {
    execSync(`cp "${join(dataDir, name)}" "${join(staging, name)}"`, { shell: true });
  }

  execSync(`tar -czf "${outTar}" -C "${staging}" .`, { shell: true });
  verifySportsDbArtifacts({ tarballPath: outTar });
  const tarMb = (statSync(outTar).size / 1024 / 1024).toFixed(2);
  const rawMb = (manifest.files.reduce((sum, f) => sum + f.bytes, 0) / 1024 / 1024).toFixed(1);
  console.log(`✓ Packaged ${files.length} JSON files → sports-db-data.tar.gz (${tarMb} MB compressed, ${rawMb} MB raw JSON)`);

  rmSync(cdnDir, { recursive: true, force: true });
  mkdirSync(cdnDir, { recursive: true });
  console.log("\n→ Building sportverse-cdn gzip chunks for browser proxy…");

  for (const name of CDN_CHUNKED_FILES) {
    const src = join(dataDir, name);
    if (!existsSync(src)) continue;
    const baseName = name.replace(/\.json$/i, "");
    const targetRawBytes = TARGET_RAW_BYTES_BY_FILE[name] ?? DEFAULT_TARGET_RAW_BYTES;
    writeGzipChunks(baseName, src, cdnDir, targetRawBytes);
  }

  for (const name of CDN_CHUNKED_FILES) {
    const baseName = name.replace(/\.json$/i, "");
    const manifestPath = join(cdnDir, `${baseName}.chunks.json`);
    if (!existsSync(manifestPath)) {
      throw new Error(`Missing ${manifestPath} — CDN chunk packaging failed`);
    }
    const chunkCount = readdirSync(cdnDir).filter((f) => f.startsWith(`${baseName}-`) && f.endsWith(".json.gz")).length;
    if (chunkCount === 0) {
      throw new Error(`No gzip chunks written for ${baseName}`);
    }
  }

  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
