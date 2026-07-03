#!/usr/bin/env node
/**
 * Download pre-built sports-db bundle from GitHub Releases (fast Netlify path).
 * Falls back to false so caller can run ETL locally.
 */
import { execSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { get as httpsGet } from "node:https";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const dataDir = join(root, "sportverse/packages/sports-db/data");

const REQUIRED = [
  { name: "players-extended.json", minBytes: 500_000 },
  { name: "season-stats.json", minBytes: 1_000_000 },
  { name: "competitions.json", minBytes: 100 },
  { name: "clubs-extended.json", minBytes: 1000 },
  { name: "era-baselines.json", minBytes: 100 },
  { name: "engine-calibration.json", minBytes: 100 },
];

function bundleUrl() {
  if (process.env.SPORTS_DB_BUNDLE_URL) return process.env.SPORTS_DB_BUNDLE_URL;
  const repo = process.env.GITHUB_REPOSITORY ?? "michaelTheKing0616/Tope-s-Portfolio";
  const tag = process.env.SPORTS_DB_RELEASE_TAG ?? "sports-db-latest";
  return `https://github.com/${repo}/releases/download/${tag}/sports-db-data.tar.gz`;
}

function downloadFile(url, dest) {
  return new Promise((resolveDl, reject) => {
    const file = createWriteStream(dest);
    httpsGet(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const next = res.headers.location;
        if (!next) {
          reject(new Error(`Redirect without location: ${url}`));
          return;
        }
        file.close();
        unlinkSync(dest);
        downloadFile(next, dest).then(resolveDl).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`Download failed (${res.statusCode}): ${url}`));
        return;
      }
      pipeline(res, file).then(resolveDl).catch(reject);
    }).on("error", reject);
  });
}

function verifyArtifacts() {
  for (const { name, minBytes } of REQUIRED) {
    const path = join(dataDir, name);
    if (!existsSync(path)) return false;
    if (statSync(path).size < minBytes) return false;
  }
  return true;
}

/**
 * @param {{ optional?: boolean }} opts
 * @returns {Promise<boolean>} true if bundle extracted and verified
 */
export async function downloadSportsDbBundle(opts = {}) {
  const url = bundleUrl();
  const archive = join(root, "sports-db-data.tar.gz");

  console.log(`→ Trying sports-db release bundle…\n  ${url}`);

  try {
    mkdirSync(dataDir, { recursive: true });
    await downloadFile(url, archive);
    execSync(`tar -xzf "${archive}" -C "${dataDir}"`, { stdio: "inherit", shell: true });
    unlinkSync(archive);

    if (!verifyArtifacts()) {
      throw new Error("Bundle extracted but required files missing or too small");
    }

    const count = readdirSync(dataDir).filter((f) => f.endsWith(".json")).length;
    console.log(`✓ Release bundle loaded (${count} JSON files in sports-db/data/)`);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (opts.optional) {
      console.warn(`  ⚠ Release bundle unavailable: ${message}`);
      console.warn("  Will run ETL instead (slower). Run GitHub Actions workflow build-sports-db first for faster deploys.");
      return false;
    }
    throw err;
  }
}
