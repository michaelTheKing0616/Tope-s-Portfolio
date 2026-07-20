#!/usr/bin/env node
/**
 * Match model validation harness — Engine v4 §4.
 * Usage: npx tsx sportverse/scripts/validate-match-model.ts
 * Writes packages/sports-db/data/sim-validation-report.json for the hub trust badge.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildScoreDistribution,
  buildValidationReport,
  computeMatchGoalRates,
  outcomeProbabilitiesFromScoreMatrix,
  SOCcer_PREDICTION_CHALLENGE_2017_BENCHMARK,
} from "../packages/match-sim/src/index.js";
import type { CrossLeagueFixture } from "../packages/sports-db/src/extended-types.js";
import type { RatedPlayerCard } from "../packages/draftballer-types/src/index.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = resolve(root, "packages/sports-db/data");

function load<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(dataDir, name), "utf8")) as T;
}

function mockSquad(ovr: number): RatedPlayerCard[] {
  const positions = ["GK", "CB", "CB", "FB", "FB", "CM", "CM", "AM", "W", "W", "ST"] as const;
  return positions.map((position, i) => ({
    playerId: `p${i}`,
    name: `p${i}`,
    nationality: "Test",
    position,
    ovr,
    tier: "gold" as const,
    attributes: {
      pac: ovr,
      sho: ovr + 2,
      pas: ovr,
      dri: ovr,
      def: ovr - 2,
      phy: ovr,
    },
    confidence: 0.9,
    breakdown: { clubOvrRaw: ovr, intlOvrRaw: ovr, awardBonus: 0, lens: "club_only" as const, blendFactor: 0 },
  }));
}

/** Deterministic shuffle — same fixtures every run for a given corpus. */
function seededHoldout(fixtures: CrossLeagueFixture[], max: number): CrossLeagueFixture[] {
  const arr = [...fixtures];
  let h = 0x9e3779b9;
  for (let i = arr.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (i + 1), 0x85ebca6b) >>> 0;
    const j = h % (i + 1);
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr.slice(0, Math.min(max, arr.length));
}

function main(): void {
  const fixtures = load<CrossLeagueFixture[]>("cross-league-fixtures.json");
  // Expand beyond the old n=40 proxy — seeded sample of up to 200 fixtures.
  const HOLDOUT_N = 200;
  const holdout = seededHoldout(fixtures, HOLDOUT_N);

  const scored = holdout.map((f) => {
    const homeOvr = f.leagueAId === "premier-league" ? 78 : 70;
    const awayOvr = f.leagueBId === "premier-league" ? 78 : 70;
    const rates = computeMatchGoalRates({
      homePlayers: mockSquad(homeOvr),
      awayPlayers: mockSquad(awayOvr),
      formationHomeId: "4-4-2",
      formationAwayId: "4-4-2",
      homeAdvantage: true,
    });
    const dist = buildScoreDistribution(rates.lambda, rates.mu, rates.rho, 6);
    const predicted = outcomeProbabilitiesFromScoreMatrix(dist);
    const actual = f.result === 1 ? "home" : f.result === 0 ? "draw" : "away";
    return { predicted, actual: actual as "home" | "draw" | "away" };
  });

  const report = buildValidationReport(scored);
  console.log("Match model validation (cross-league holdout):");
  console.log(`  fixtures: ${report.count} (of ${fixtures.length} available)`);
  console.log(`  RPS: ${report.rps.toFixed(4)} (benchmark ${SOCcer_PREDICTION_CHALLENGE_2017_BENCHMARK.rps})`);
  console.log(`  Brier: ${report.brier.toFixed(4)}`);
  console.log(`  Log-loss: ${report.logLoss.toFixed(4)}`);
  console.log(`  Accuracy: ${(report.accuracy * 100).toFixed(1)}% (benchmark ${(SOCcer_PREDICTION_CHALLENGE_2017_BENCHMARK.accuracy * 100).toFixed(1)}%)`);

  const artifact = {
    ...report,
    generatedAt: new Date().toISOString(),
    note: `Cross-league holdout n=${report.count} (seeded sample of ${fixtures.length}) — directional vs 2017 Soccer Prediction Challenge, not an identical task.`,
    corpusSize: fixtures.length,
    benchmarkRps: SOCcer_PREDICTION_CHALLENGE_2017_BENCHMARK.rps,
    benchmarkAccuracy: SOCcer_PREDICTION_CHALLENGE_2017_BENCHMARK.accuracy,
  };
  const outPath = resolve(dataDir, "sim-validation-report.json");
  writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  console.log(`  wrote ${outPath}`);
}

main();
