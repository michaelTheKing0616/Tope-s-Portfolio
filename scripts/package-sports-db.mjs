#!/usr/bin/env node
/**
 * Tarball all sports-db JSON for GitHub Release upload (Netlify downloads this bundle).
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { gzipSync } from "node:zlib";
import { verifySportsDbArtifacts } from "./verify-sports-db-artifacts.mjs";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const dataDir = join(root, "sportverse/packages/sports-db/data");
const outTar = join(root, "sports-db-data.tar.gz");

/** Large JSON served via GitHub Release + gzip in the browser (Netlify cannot host 300MB+). */
const CDN_GZIP_FILES = ["season-stats.json", "players-extended.json"];

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

  for (const name of CDN_GZIP_FILES) {
    const src = join(dataDir, name);
    if (!existsSync(src)) continue;
    const outGz = join(root, `${name}.gz`);
    const raw = readFileSync(src);
    writeFileSync(outGz, gzipSync(raw, { level: 9 }));
    const gzMb = (statSync(outGz).size / 1024 / 1024).toFixed(2);
    console.log(`✓ ${name}.gz (${gzMb} MB) — browser CDN asset for Netlify`);
  }

  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
