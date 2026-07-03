#!/usr/bin/env node
/**
 * Download sportverse/archive zip for CI or local use.
 * - Google Drive share links → gdown (handles large-file confirm page)
 * - Direct URLs (R2, Dropbox dl=1, etc.) → HTTPS download
 */
import { execSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { get as httpsGet } from "node:https";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";

const MIN_ZIP_BYTES = 10_000_000;
const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const archiveDir = join(root, "sportverse/archive");
const cacheDir = join(root, ".cache");
const zipPath = join(cacheDir, "sportverse-archive.zip");

function getUrl() {
  const url = process.env.ARCHIVE_URL ?? process.argv[2];
  if (!url?.trim()) {
    throw new Error("Set ARCHIVE_URL env var or pass URL as first argument");
  }
  return url.trim();
}

function isGoogleDrive(url) {
  return url.includes("drive.google.com") || url.includes("drive.usercontent.google.com");
}

function downloadDirect(url, dest) {
  return new Promise((resolveDl, reject) => {
    httpsGet(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadDirect(res.headers.location, dest).then(resolveDl).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      pipeline(res, createWriteStream(dest)).then(resolveDl).catch(reject);
    }).on("error", reject);
  });
}

function downloadWithGdown(url, dest) {
  execSync(
    `python3 -m pip install -q gdown && gdown --fuzzy "${url.replace(/"/g, '\\"')}" -O "${dest}"`,
    { stdio: "inherit", shell: true },
  );
}

function verifyAndExtract(zip) {
  const size = statSync(zip).size;
  if (size < MIN_ZIP_BYTES) {
    throw new Error(
      `Download too small (${size} bytes) — expected ~80MB+ zip. Got an HTML error page instead of the file.`,
    );
  }
  console.log(`✓ Archive zip: ${(size / 1024 / 1024).toFixed(2)} MB`);

  rmSync(archiveDir, { recursive: true, force: true });
  mkdirSync(archiveDir, { recursive: true });

  const isWin = process.platform === "win32";
  if (isWin) {
    execSync(
      `powershell -NoProfile -Command "Expand-Archive -Path '${zip.replace(/'/g, "''")}' -DestinationPath '${archiveDir.replace(/'/g, "''")}' -Force"`,
      { stdio: "inherit" },
    );
  } else {
    execSync(`unzip -q "${zip}" -d "${archiveDir}"`, { stdio: "inherit", shell: true });
  }

  const profiles = join(archiveDir, "player_profiles/player_profiles.csv");
  if (!existsSync(profiles)) {
    throw new Error(
      "Invalid zip layout — folders like player_profiles/ must be at the zip root (not nested inside archive/)",
    );
  }
  console.log("✓ Archive extracted to sportverse/archive/");
}

async function main() {
  const url = getUrl();
  mkdirSync(cacheDir, { recursive: true });

  console.log("→ Downloading Transfermarkt archive…");
  console.log(`  ${url}`);

  if (isGoogleDrive(url)) {
    console.log("  Provider: Google Drive (gdown)");
    downloadWithGdown(url, zipPath);
  } else {
    console.log("  Provider: direct HTTPS");
    await downloadDirect(url, zipPath);
  }

  verifyAndExtract(zipPath);
}

main().catch((err) => {
  console.error("\n✗ Archive download failed:", err.message ?? err);
  process.exit(1);
});
