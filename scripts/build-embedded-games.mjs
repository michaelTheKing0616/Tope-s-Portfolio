#!/usr/bin/env node
/**
 * Builds SPORTVERSE and copies the static output into the Astro portfolio
 * at public/play/sportverse/ so all games live under one deployed site.
 */
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { copySportsDbDataForDeploy } from "./split-sports-db-for-deploy.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sportverseRoot = join(root, "sportverse");
const webDir = join(sportverseRoot, "apps", "web");
const distDir = join(webDir, "dist");
const outDir = join(root, "public", "play", "sportverse");
const basePath = "/play/sportverse/";

function run(cmd, cwd, env = {}) {
  execSync(cmd, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, ...env },
    shell: true,
  });
}

console.log("→ Installing SPORTVERSE dependencies (if needed)…");
if (!existsSync(join(sportverseRoot, "node_modules"))) {
  run("npm install", sportverseRoot);
}

console.log(`→ Building SPORTVERSE web app (base: ${basePath})…`);
run("npm run build", webDir, { VITE_BASE_PATH: basePath });

if (!existsSync(distDir)) {
  console.error("Build failed: dist folder missing at", distDir);
  process.exit(1);
}

console.log(`→ Copying to ${outDir}…`);
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
cpSync(distDir, outDir, { recursive: true });

const dataSrc = join(sportverseRoot, "packages", "sports-db", "data");
const dataDest = join(outDir, "data");
if (existsSync(dataSrc)) {
  const { copied, chunked } = copySportsDbDataForDeploy(dataSrc, dataDest, { split: false });
  if (chunked.length) {
    console.log(`  Chunked (not deployed as monolith): ${chunked.join(", ")}`);
  }
  console.log(`  Copied ${copied} small JSON files + chunks/`);
} else {
  console.warn("  ⚠ sports-db/data missing — run npm run prebuild:data first");
}

console.log("✓ SPORTVERSE embedded at public/play/sportverse/");
console.log("  Play URL after deploy: /play/sportverse/");
