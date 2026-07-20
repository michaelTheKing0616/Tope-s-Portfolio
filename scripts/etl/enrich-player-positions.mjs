#!/usr/bin/env node
/**
 * Backfill fine-grained positions from the Transfermarkt archive into
 * sports-db players-extended.json.
 *
 * The original ETL collapsed "Defender - Right-Back" → "Defender", which the
 * rating engine then mapped to CM — leaving the draft pool with almost zero
 * FB/CB/W/DM/AM players. This script rewrites `position` in place using
 * player_profiles.csv, matched via tmId / tm-<id> ids / player-aliases.json.
 *
 * Idempotent: safe to re-run.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ARCHIVE_DIR, OUT_DIR, readCsv } from "./utils.mjs";
import { refineArchivePosition } from "./competition-map.mjs";

const PROFILES_CSV = resolve(ARCHIVE_DIR, "player_profiles/player_profiles.csv");
const PLAYERS_JSON = resolve(OUT_DIR, "players-extended.json");
const ALIASES_JSON = resolve(OUT_DIR, "player-aliases.json");

const COARSE = new Set(["Defender", "Midfielder", "Forward", "Attack", "Midfield", ""]);

function main() {
  console.log("→ Reading archive profiles…");
  const positionByTmId = new Map();
  for (const row of readCsv(PROFILES_CSV)) {
    if (!row.player_id) continue;
    const fine = refineArchivePosition(row.main_position, row.position);
    if (fine) positionByTmId.set(row.player_id, fine);
  }
  console.log(`  ${positionByTmId.size} profiles with positions`);

  const aliasTmByCanonical = new Map();
  for (const alias of JSON.parse(readFileSync(ALIASES_JSON, "utf8"))) {
    if (alias.curatedId && alias.tmId) aliasTmByCanonical.set(alias.curatedId, alias.tmId);
  }

  const players = JSON.parse(readFileSync(PLAYERS_JSON, "utf8"));
  let updated = 0;
  let alreadyFine = 0;
  let unmatched = 0;

  for (const p of players) {
    const tmId = p.tmId ?? aliasTmByCanonical.get(p.id) ?? (p.id.startsWith("tm-") ? p.id.slice(3) : null);
    const fine = tmId ? positionByTmId.get(String(tmId)) : null;
    if (!fine) {
      unmatched++;
      continue;
    }
    if (p.position === fine) {
      alreadyFine++;
      continue;
    }
    // Never downgrade an existing fine-grained tag to a coarse one.
    if (COARSE.has(fine) && !COARSE.has(p.position ?? "")) {
      alreadyFine++;
      continue;
    }
    p.position = fine;
    updated++;
  }

  writeFileSync(PLAYERS_JSON, JSON.stringify(players));
  console.log(`  ✓ updated ${updated}, unchanged ${alreadyFine}, no archive match ${unmatched}`);

  const counts = new Map();
  for (const p of players) counts.set(p.position, (counts.get(p.position) ?? 0) + 1);
  console.log("  position distribution:", [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15));
}

main();
