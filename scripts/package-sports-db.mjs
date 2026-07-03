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
/** Raw JSON batch size before gzip (~20:1 ratio on season-stats). */
const TARGET_RAW_BYTES = 80_000_000;

const CDN_CHUNKED_FILES = ["season-stats.json", "players-extended.json"];

/**
 * @param {string} baseName
 * @param {string} jsonPath
 * @param {string} outDir
 */
function writeGzipChunks(baseName, jsonPath, outDir) {
  const items = JSON.parse(readFileSync(jsonPath, "utf8"));
  if (!Array.isArray(items)) {
    throw new Error(`${jsonPath} is not a JSON array`);
  }

  const chunkFiles = [];
  let batch = [];
  let batchBytes = 2;

  function flushBatch() {
    if (!batch.length) return;
    const gz = gzipSync(JSON.stringify(batch), { level: 9 });
    if (gz.length > MAX_GZIP_BYTES) {
      throw new Error(
        `${baseName} chunk ${chunkFiles.length} is ${(gz.length / 1024 / 1024).toFixed(2)} MB — reduce TARGET_RAW_BYTES`,
      );
    }
    const name = `${baseName}-${String(chunkFiles.length).padStart(3, "0")}.json.gz`;
    writeFileSync(join(outDir, name), gz);
    chunkFiles.push(name);
    batch = [];
    batchBytes = 2;
  }

  for (const item of items) {
    const itemBytes = Buffer.byteLength(JSON.stringify(item), "utf8") + 1;
    if (batch.length && batchBytes + itemBytes > TARGET_RAW_BYTES) {
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
    writeGzipChunks(baseName, src, cdnDir);
  }

  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
