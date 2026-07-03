#!/usr/bin/env node
/**
 * LSI v2 job entry — delegates to TypeScript implementation.
 * Usage: node sportverse/scripts/compute-lsi.mjs [--write]
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = ["tsx", "scripts/compute-lsi.ts", ...process.argv.slice(2)];
const result = spawnSync("npx", args, { cwd: root, stdio: "inherit", shell: true });
process.exit(result.status ?? 1);
