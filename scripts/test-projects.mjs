#!/usr/bin/env node
/**
 * Run portfolio subproject tests — installs deps on first run.
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const projects = ["kobo", "tatafo", "pulse", "ayo-master", "naija-utils", "akowe"];

for (const name of projects) {
  const dir = join(root, "projects", name);
  if (!existsSync(join(dir, "node_modules"))) {
    console.log(`→ Installing ${name}…`);
    execSync("npm install", { cwd: dir, stdio: "inherit" });
  }
  console.log(`→ Testing ${name}…`);
  execSync("npm test", { cwd: dir, stdio: "inherit" });
}

console.log("✓ All portfolio project tests passed");
