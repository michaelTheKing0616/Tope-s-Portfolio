#!/usr/bin/env node
/**
 * Shared size checks for sports-db JSON outputs (CI + Netlify).
 */
import { existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const dataDir = join(root, "sportverse/packages/sports-db/data");
const archiveProfiles = join(root, "sportverse/archive/player_profiles/player_profiles.csv");

export function hasLocalArchive() {
  return existsSync(archiveProfiles);
}

/** @returns {{ mode: string, playersExtended: number, seasonStats: number, tarball?: number }} */
export function getBuildThresholds() {
  if (hasLocalArchive()) {
    return {
      mode: "archive",
      playersExtended: 30_000_000,
      seasonStats: 80_000_000,
      tarball: 25_000_000,
    };
  }
  return {
    mode: "cdn",
    playersExtended: 5_000_000,
    seasonStats: 2_000_000,
    tarball: 3_000_000,
  };
}

export function verifySportsDbArtifacts(options = {}) {
  const { tarballPath } = options;
  const t = getBuildThresholds();

  console.log(`\n→ Verifying sports-db artifacts (${t.mode} build thresholds)…`);

  const checks = [
    { name: "players-extended.json", minBytes: t.playersExtended },
    { name: "season-stats.json", minBytes: t.seasonStats },
    { name: "competitions.json", minBytes: 100 },
    { name: "clubs-extended.json", minBytes: 1000 },
    { name: "era-baselines.json", minBytes: 100 },
    { name: "engine-calibration.json", minBytes: 100 },
    { name: "league-strength-index.json", minBytes: 100 },
    { name: "player-transfers.json", minBytes: 1000 },
    { name: "cross-league-fixtures.json", minBytes: 100 },
  ];

  for (const { name, minBytes } of checks) {
    const path = join(dataDir, name);
    if (!existsSync(path)) {
      throw new Error(`Missing required data file: ${name}`);
    }
    const size = statSync(path).size;
    if (size < minBytes) {
      throw new Error(
        `${name} is too small (${(size / 1024 / 1024).toFixed(2)} MB, need ≥ ${(minBytes / 1024 / 1024).toFixed(2)} MB) — ETL or archive download failed`,
      );
    }
    console.log(`  ✓ ${name} (${(size / 1024 / 1024).toFixed(2)} MB)`);
  }

  if (tarballPath) {
    if (!existsSync(tarballPath)) throw new Error(`Missing tarball: ${tarballPath}`);
    const size = statSync(tarballPath).size;
    if (size < t.tarball) {
      throw new Error(
        `sports-db-data.tar.gz too small (${(size / 1024 / 1024).toFixed(2)} MB, need ≥ ${(t.tarball / 1024 / 1024).toFixed(2)} MB for ${t.mode} build)`,
      );
    }
    console.log(`  ✓ sports-db-data.tar.gz (${(size / 1024 / 1024).toFixed(2)} MB)`);
  }

  if (t.mode === "archive") {
    console.log("  ✓ Archive build verified — full Transfermarkt pool");
  }
}

function parseCli() {
  const args = process.argv.slice(2);
  const tarballIdx = args.indexOf("--tarball");
  return {
    tarballPath: tarballIdx >= 0 ? args[tarballIdx + 1] : undefined,
  };
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  const { tarballPath } = parseCli();
  try {
    verifySportsDbArtifacts({ tarballPath });
  } catch (err) {
    console.error("\n✗", err.message ?? err);
    process.exit(1);
  }
}
