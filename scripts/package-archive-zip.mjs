#!/usr/bin/env node
/**
 * Create sportverse-archive.zip with forward-slash paths (CI-safe on Linux).
 * Prefer this over PowerShell Compress-Archive, which breaks unzip on Ubuntu.
 */
import { execSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const archiveDir = join(root, "sportverse/archive");
const outZip = join(root, "sportverse-archive.zip");
const profiles = join(archiveDir, "player_profiles/player_profiles.csv");

if (!existsSync(profiles)) {
  console.error("Missing", profiles);
  console.error("Place Transfermarkt CSVs under sportverse/archive/ first.");
  process.exit(1);
}

execSync(`tar -a -cf "${outZip}" -C "${archiveDir}" .`, { stdio: "inherit", shell: true });

const mb = (statSync(outZip).size / 1024 / 1024).toFixed(2);
console.log(`✓ Created ${outZip} (${mb} MB) — upload this to Google Drive`);
