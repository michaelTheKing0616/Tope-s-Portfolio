#!/usr/bin/env node
/**
 * Download pre-built sports-db bundle from GitHub Releases (fast Netlify path).
 * Falls back to false so caller can run ETL locally.
 */
import { execSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { get as httpsGet } from "node:https";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { verifySportsDbArtifacts } from "./verify-sports-db-artifacts.mjs";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const dataDir = join(root, "sportverse/packages/sports-db/data");

function bundleUrl() {
  if (process.env.SPORTS_DB_BUNDLE_URL) return process.env.SPORTS_DB_BUNDLE_URL;
  const repo = process.env.SPORTS_DB_REPO ?? "michaelTheKing0616/Tope-s-Portfolio";
  const tag = process.env.SPORTS_DB_RELEASE_TAG ?? "sports-db-latest";
  return `https://github.com/${repo}/releases/download/${tag}/sports-db-data.tar.gz`;
}

async function downloadFile(url, dest) {
  if (typeof fetch === "function") {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) {
      throw new Error(`Download failed (${res.status}): ${url}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(dest, buf);
    return;
  }

  return new Promise((resolveDl, reject) => {
    const file = createWriteStream(dest);
    httpsGet(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
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
  try {
    verifySportsDbArtifacts();
    return true;
  } catch {
    return false;
  }
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
    const archiveSize = statSync(archive).size;
    if (archiveSize < 3_000_000) {
      throw new Error(`Downloaded file too small (${archiveSize} bytes) — likely an error page, not a tarball`);
    }
    execSync(`tar -xzf "${archive}" -C "${dataDir}"`, { stdio: "inherit", shell: true });
    unlinkSync(archive);

    verifySportsDbArtifacts();

    const count = readdirSync(dataDir).filter((f) => f.endsWith(".json")).length;
    const statsMb = (statSync(join(dataDir, "season-stats.json")).size / 1024 / 1024).toFixed(1);
    console.log(`✓ Release bundle loaded (${count} JSON files, season-stats ${statsMb} MB uncompressed)`);
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
