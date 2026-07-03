#!/usr/bin/env node
/**
 * Match model validation harness — Engine v4 §4.
 * Usage: npx tsx sportverse/scripts/validate-match-model.ts
 */
import { readFileSync } from "node:fs";
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

function main(): void {
  const fixtures = load<CrossLeagueFixture[]>("cross-league-fixtures.json");
  const holdout = fixtures.slice(0, Math.min(40, fixtures.length));

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
  console.log("Match model validation (cross-league holdout proxy):");
  console.log(`  fixtures: ${report.count}`);
  console.log(`  RPS: ${report.rps.toFixed(4)} (benchmark ${SOCcer_PREDICTION_CHALLENGE_2017_BENCHMARK.rps})`);
  console.log(`  Brier: ${report.brier.toFixed(4)}`);
  console.log(`  Log-loss: ${report.logLoss.toFixed(4)}`);
  console.log(`  Accuracy: ${(report.accuracy * 100).toFixed(1)}% (benchmark ${(SOCcer_PREDICTION_CHALLENGE_2017_BENCHMARK.accuracy * 100).toFixed(1)}%)`);
}

main();
