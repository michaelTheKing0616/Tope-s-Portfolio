#!/usr/bin/env node
/**
 * Refit EA_POSITION_WEIGHTS from ea_fc26_players.csv via least squares.
 * Outputs updated weights for ea-ratings.ts and a MAE report.
 *
 * Usage: node scripts/etl/fit-ea-position-weights.mjs
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "./utils.mjs";
import { mapEaToQuizPosition } from "./build-ea-fc26-index.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const EA_CSV = resolve(ROOT, "sportverse/eafc26_player_ratings/ea_fc26_players.csv");
const OUT_REPORT = resolve(ROOT, "BUILD_LOG_EA_WEIGHTS.txt");

const OUTFIELD_ATTRS = ["pac", "sho", "pas", "dri", "def", "phy"];
const GK_ATTRS = ["gkDiving", "gkHandling", "gkKicking", "gkPositioning", "gkReflexes"];
const GK_KEYS = ["diving", "handling", "kicking", "positioning", "reflexes"];

function int(row, key) {
  const n = Number(row[key]);
  return Number.isFinite(n) ? n : 0;
}

/** Normal equation solve: (X'X)w = X'y */
function solveLeastSquares(rows, attrKeys) {
  const k = attrKeys.length;
  const xtx = Array.from({ length: k }, () => Array(k).fill(0));
  const xty = Array(k).fill(0);

  for (const row of rows) {
    const x = attrKeys.map((key) => int(row, key));
    const y = int(row, "overallRating");
    for (let i = 0; i < k; i++) {
      xty[i] += x[i] * y;
      for (let j = 0; j < k; j++) xtx[i][j] += x[i] * x[j];
    }
  }

  // Gaussian elimination
  const aug = xtx.map((row, i) => [...row, xty[i]]);
  for (let col = 0; col < k; col++) {
    let pivot = col;
    for (let r = col + 1; r < k; r++) {
      if (Math.abs(aug[r][col]) > Math.abs(aug[pivot][col])) pivot = r;
    }
    [aug[col], aug[pivot]] = [aug[pivot], aug[col]];
    const div = aug[col][col] || 1e-9;
    for (let j = col; j <= k; j++) aug[col][j] /= div;
    for (let r = 0; r < k; r++) {
      if (r === col) continue;
      const factor = aug[r][col];
      for (let j = col; j <= k; j++) aug[r][j] -= factor * aug[col][j];
    }
  }
  return aug.map((row) => row[k]);
}

function clampWeights(raw) {
  const clamped = raw.map((w) => Math.max(0, w));
  const sum = clamped.reduce((s, w) => s + w, 0) || 1;
  return clamped.map((w) => Math.round((w / sum) * 1000) / 1000);
}

function predict(row, attrKeys, weights) {
  const sum = attrKeys.reduce((s, key, i) => s + int(row, key) * weights[i], 0);
  return Math.max(1, Math.min(99, Math.round(sum)));
}

function mae(rows, attrKeys, weights) {
  if (!rows.length) return 0;
  return (
    rows.reduce((s, row) => s + Math.abs(predict(row, attrKeys, weights) - int(row, "overallRating")), 0) /
    rows.length
  );
}

function main() {
  if (!existsSync(EA_CSV)) {
    console.error("Missing", EA_CSV);
    process.exit(1);
  }

  const rows = parseCsv(readFileSync(EA_CSV, "utf8"));
  const byPos = new Map();
  const gkRows = [];

  for (const row of rows) {
    if ((row.position ?? "").toUpperCase() === "GK") {
      gkRows.push(row);
      continue;
    }
    const pos = mapEaToQuizPosition(row.position);
    const list = byPos.get(pos) ?? [];
    list.push(row);
    byPos.set(pos, list);
  }

  const positions = ["ST", "W", "AM", "CM", "DM", "FB", "CB"];
  const weights = {};
  const lines = ["# EA position weight refit", `Generated: ${new Date().toISOString()}`, ""];

  for (const pos of positions) {
    const data = byPos.get(pos) ?? [];
    const raw = solveLeastSquares(data, OUTFIELD_ATTRS);
    const w = clampWeights(raw);
    weights[pos] = Object.fromEntries(OUTFIELD_ATTRS.map((k, i) => [k, w[i]]));
    lines.push(`${pos}: n=${data.length} MAE=${mae(data, OUTFIELD_ATTRS, w).toFixed(2)}`);
    lines.push(`  ${JSON.stringify(weights[pos])}`);
  }

  const gkRaw = solveLeastSquares(gkRows, GK_ATTRS);
  const gkW = clampWeights(gkRaw);
  const gkWeights = Object.fromEntries(GK_KEYS.map((k, i) => [k, gkW[i]]));
  lines.push(`GK: n=${gkRows.length} MAE=${mae(gkRows, GK_ATTRS, gkW).toFixed(2)}`);
  lines.push(`  ${JSON.stringify(gkWeights)}`);

  lines.push("");
  lines.push("## TypeScript snippet (ea-ratings.ts)");
  lines.push("export const EA_POSITION_WEIGHTS = {");
  for (const pos of positions) {
    const w = weights[pos];
    lines.push(
      `  ${pos}: { pac: ${w.pac}, sho: ${w.sho}, pas: ${w.pas}, dri: ${w.dri}, def: ${w.def}, phy: ${w.phy} },`,
    );
  }
  lines.push(`  GK: { pac: 0.05, sho: 0.02, pas: 0.08, dri: 0.05, def: 0.35, phy: 0.45 },`);
  lines.push("};");
  lines.push("");
  lines.push(`export const EA_GK_WEIGHTS = ${JSON.stringify(gkWeights, null, 2)};`);

  const out = lines.join("\n");
  console.log(out);
  writeFileSync(OUT_REPORT, `${out}\n`);

  // Emit JSON for programmatic update
  writeFileSync(
    resolve(ROOT, "sportverse/packages/sports-db/data/ea-fitted-weights.json"),
    JSON.stringify({ outfield: weights, gk: gkWeights }, null, 2),
  );
}

main();
