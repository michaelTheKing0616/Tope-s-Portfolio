#!/usr/bin/env node
/**
 * Tarball all sports-db JSON for GitHub Release upload (Netlify downloads this bundle).
 */
import { execSync } from "node:child_process";
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const dataDir = join(root, "sportverse/packages/sports-db/data");
const outTar = join(root, "sports-db-data.tar.gz");

const REQUIRED = [
  "players-extended.json",
  "season-stats.json",
  "competitions.json",
  "clubs-extended.json",
  "era-baselines.json",
  "engine-calibration.json",
];

function verify() {
  for (const name of REQUIRED) {
    const path = join(dataDir, name);
    if (!statSync(path).isFile()) throw new Error(`Missing ${name}`);
  }
}

async function main() {
  verify();

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
  const sizeMb = (statSync(outTar).size / 1024 / 1024).toFixed(2);
  console.log(`✓ Packaged ${files.length} JSON files → sports-db-data.tar.gz (${sizeMb} MB)`);
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
