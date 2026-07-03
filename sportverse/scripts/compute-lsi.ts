#!/usr/bin/env node
/**
 * Seasonal LSI v2 recomputation job (Statistical Rigor Standard §2).
 * Usage: npx tsx sportverse/scripts/compute-lsi.ts [--write]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { computeLsiV2 } from "../packages/rating-engine/src/lsi-v2.js";
import type {
  CrossLeagueFixture,
  LeagueStrengthIndexEntry,
  PlayerTransfer,
} from "../packages/sports-db/src/extended-types.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = resolve(root, "packages/sports-db/data");

function load<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(dataDir, name), "utf8")) as T;
}

function main(): void {
  const fixtures = load<CrossLeagueFixture[]>("cross-league-fixtures.json");
  const transfers = load<PlayerTransfer[]>("player-transfers.json");
  const existing = load<LeagueStrengthIndexEntry[]>("league-strength-index.json");

  const { rows, weights, sigmaLsi, shrinkageK, holdoutAccuracy } = computeLsiV2({
    fixtures,
    transfers,
    existing,
  });

  console.log(
    `LSI v2: ${rows.length} rows from ${fixtures.length} fixtures, ${transfers.length} transfers.`,
  );
  console.log(
    `Weights: elo=${weights.elo.toFixed(2)} transfer=${weights.transfer.toFixed(2)} talent=${weights.talent.toFixed(2)} nat=${weights.nat.toFixed(2)}`,
  );
  console.log(`sigma_LSI=${sigmaLsi}, k=${shrinkageK}, holdout accuracy=${(holdoutAccuracy * 100).toFixed(1)}%`);

  if (process.argv.includes("--write")) {
    writeFileSync(resolve(dataDir, "league-strength-index.json"), `${JSON.stringify(rows, null, 2)}\n`);
    console.log("Wrote league-strength-index.json");
  } else {
    console.log("Preview (first 5):", rows.slice(0, 5));
    console.log("Pass --write to persist.");
  }
}

main();
