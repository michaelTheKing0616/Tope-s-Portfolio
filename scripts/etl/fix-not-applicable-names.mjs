#!/usr/bin/env node
/**
 * Repair corrupted player names: 354 archive rows (mostly mononym Brazilian
 * legends — Zico, Garrincha, Sócrates…) carry a literal "not applicable "
 * prefix leaked from Transfermarkt's name_in_home_country field.
 * User-visible in quizzes and drafts, and it breaks name-based lookups.
 *
 * Idempotent: safe to re-run.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { OUT_DIR } from "./utils.mjs";

const PLAYERS_JSON = resolve(OUT_DIR, "players-extended.json");

const players = JSON.parse(readFileSync(PLAYERS_JSON, "utf8"));
let fixed = 0;
for (const p of players) {
  const name = String(p.name ?? "");
  if (/^not applicable\s+/i.test(name)) {
    p.name = name.replace(/^not applicable\s+/i, "").trim();
    fixed++;
  }
}
writeFileSync(PLAYERS_JSON, JSON.stringify(players));
console.log(`✓ repaired ${fixed} "not applicable" player names`);
