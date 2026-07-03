#!/usr/bin/env node
/**
 * Fit Engine v4 calibration from archive-derived datasets.
 * Usage: npx tsx sportverse/scripts/calibrate-engine.ts [--write]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { computeLsiV2 } from "../packages/rating-engine/src/lsi-v2.js";
import {
  fitAggregationBridge,
  type BridgeCalibrationRow,
} from "../packages/match-sim/src/aggregation-bridge.js";
import type {
  CrossLeagueFixture,
  LeagueStrengthIndexEntry,
  PlayerTransfer,
} from "../packages/sports-db/src/extended-types.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = resolve(root, "packages/sports-db/data");

interface TeamSeasonRecord {
  teamId: string;
  seasonLabel: string;
  leagueId: string;
  goalsFor: number;
  goalsAgainst: number;
  matchesProxy: number;
}

export interface EngineCalibration {
  version: 1;
  fittedAt: string;
  source: "archive-calibration-etl";
  aggregationBridge: {
    alphaIntercept: number;
    alphaSlope: number;
    betaIntercept: number;
    betaSlope: number;
    calibrationMae: { alphaMae: number; betaMae: number };
    rowCount: number;
  };
  leagueBridging: {
    scalingBase: number;
    scalingSlope: number;
    scalingMin: number;
    scalingMax: number;
    shiftSlope: number;
    shiftMin: number;
    shiftMax: number;
    transferSampleSize: number;
  };
  lsi: {
    weights: { elo: number; transfer: number; talent: number; nat: number };
    sigmaLsi: number;
    shrinkageK: number;
    holdoutAccuracy: number;
  };
}

function load<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(dataDir, name), "utf8")) as T;
}

function fitLinear(xs: number[], ys: number[]): { intercept: number; slope: number } {
  const n = xs.length;
  if (n < 3) return { intercept: 0, slope: 0 };
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) ** 2;
  }
  const slope = den > 1e-9 ? num / den : 0;
  return { intercept: my - slope * mx, slope };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Map team goal rates → bridge calibration rows (§3.2). */
function bridgeRowsFromTeamSeasons(records: TeamSeasonRecord[]): BridgeCalibrationRow[] {
  const byLeague = new Map<string, { gf: number; ga: number; n: number }>();
  for (const r of records) {
    const cur = byLeague.get(r.leagueId) ?? { gf: 0, ga: 0, n: 0 };
    cur.gf += r.goalsFor / Math.max(r.matchesProxy, 1);
    cur.ga += r.goalsAgainst / Math.max(r.matchesProxy, 1);
    cur.n += 1;
    byLeague.set(r.leagueId, cur);
  }

  const leagueAvgGf =
    [...byLeague.values()].reduce((s, v) => s + v.gf / v.n, 0) / Math.max(byLeague.size, 1);
  const leagueAvgGa =
    [...byLeague.values()].reduce((s, v) => s + v.ga / v.n, 0) / Math.max(byLeague.size, 1);

  const rows: BridgeCalibrationRow[] = [];
  for (const r of records) {
    const gpg = r.goalsFor / Math.max(r.matchesProxy, 1);
    const gcpg = r.goalsAgainst / Math.max(r.matchesProxy, 1);
    const attackSignal = clamp(48 + (gpg / Math.max(leagueAvgGf, 0.8)) * 28, 45, 90);
    const defenseWeakness = clamp(25 + (gcpg / Math.max(leagueAvgGa, 0.8)) * 35, 18, 58);
    const alphaTarget = Math.log(Math.max(gpg, 0.3) / Math.max(leagueAvgGf, 0.8));
    const betaTarget = Math.log(Math.max(gcpg, 0.3) / Math.max(leagueAvgGa, 0.8));
    rows.push({ attackSignal, defenseWeakness, alphaTarget, betaTarget });
  }

  return rows.slice(0, 800);
}

/** Fit LSI bridging bounds from transfer z-delta vs league strength gap (§4). */
function fitLeagueBridging(
  transfers: PlayerTransfer[],
  lsiByLeague: Map<string, number>,
): EngineCalibration["leagueBridging"] {
  const xs: number[] = [];
  const deltaZ: number[] = [];

  for (const t of transfers) {
    if (t.roleChangeFlag || t.minutesPre < 900) continue;
    const fromLsi = lsiByLeague.get(t.fromLeagueId);
    const toLsi = lsiByLeague.get(t.toLeagueId);
    if (fromLsi == null || toLsi == null) continue;
    const gap = toLsi - fromLsi;
    const observed = t.postMoveZ - t.preMoveZ;
    xs.push(gap);
    deltaZ.push(observed);
  }

  const shiftFit = fitLinear(xs, deltaZ);
  const scalingFit = fitLinear(
    xs,
    xs.map((g, i) => 1 + deltaZ[i]! * 0.08),
  );

  return {
    scalingBase: clamp(scalingFit.intercept, 0.82, 0.98),
    scalingSlope: clamp(scalingFit.slope, 0.15, 0.35),
    scalingMin: 0.75,
    scalingMax: 1.15,
    shiftSlope: clamp(shiftFit.slope * 4, 2, 6),
    shiftMin: -3,
    shiftMax: 3,
    transferSampleSize: xs.length,
  };
}

function bridgeMae(coeffs: ReturnType<typeof fitAggregationBridge>, rows: BridgeCalibrationRow[]) {
  let alphaErr = 0;
  let betaErr = 0;
  for (const r of rows) {
    const alphaPred =
      coeffs.alphaIntercept + coeffs.alphaSlope * ((r.attackSignal - 65) / 20);
    const betaPred =
      coeffs.betaIntercept + coeffs.betaSlope * ((r.defenseWeakness - 35) / 20);
    alphaErr += Math.abs(alphaPred - r.alphaTarget);
    betaErr += Math.abs(betaPred - r.betaTarget);
  }
  return { alphaMae: alphaErr / rows.length, betaMae: betaErr / rows.length };
}

function main(): void {
  const fixtures = load<CrossLeagueFixture[]>("cross-league-fixtures.json");
  const transfers = load<PlayerTransfer[]>("player-transfers.json");
  const existing = load<LeagueStrengthIndexEntry[]>("league-strength-index.json");
  let teamRecords: TeamSeasonRecord[] = [];
  try {
    teamRecords = load<TeamSeasonRecord[]>("team-season-records.json");
  } catch {
    console.warn("team-season-records.json missing — using expert-prior bridge rows only");
  }

  const lsiResult = computeLsiV2({ fixtures, transfers, existing });
  const bridgeRows =
    teamRecords.length >= 50 ? bridgeRowsFromTeamSeasons(teamRecords) : undefined;
  const bridgeCoeffs = fitAggregationBridge(bridgeRows);
  const mae = bridgeMae(bridgeCoeffs, bridgeRows ?? []);

  const lsiByLeague = new Map<string, number>();
  for (const row of lsiResult.rows) {
    lsiByLeague.set(row.competitionId, row.lsiFinal);
  }
  const leagueBridging = fitLeagueBridging(transfers, lsiByLeague);

  const calibration: EngineCalibration = {
    version: 1,
    fittedAt: new Date().toISOString(),
    source: "archive-calibration-etl",
    aggregationBridge: {
      ...bridgeCoeffs,
      calibrationMae: mae,
      rowCount: bridgeRows?.length ?? 0,
    },
    leagueBridging,
    lsi: {
      weights: lsiResult.weights,
      sigmaLsi: lsiResult.sigmaLsi,
      shrinkageK: lsiResult.shrinkageK,
      holdoutAccuracy: lsiResult.holdoutAccuracy,
    },
  };

  console.log("Engine calibration preview:");
  console.log(JSON.stringify(calibration, null, 2));

  if (process.argv.includes("--write")) {
    writeFileSync(
      resolve(dataDir, "engine-calibration.json"),
      `${JSON.stringify(calibration, null, 2)}\n`,
    );
    writeFileSync(
      resolve(dataDir, "league-strength-index.json"),
      `${JSON.stringify(lsiResult.rows, null, 2)}\n`,
    );
    console.log("Wrote engine-calibration.json and league-strength-index.json");
  } else {
    console.log("Pass --write to persist.");
  }
}

main();
