import { describe, expect, it } from "vitest";
import {
  brierScore,
  buildValidationReport,
  logLoss,
  outcomeProbabilitiesFromScoreMatrix,
  rankedProbabilityScore,
  SOCcer_PREDICTION_CHALLENGE_2017_BENCHMARK,
} from "./validation.js";
import { buildScoreDistribution } from "./dixon-coles.js";

describe("validation metrics — §4.1", () => {
  it("perfect prediction yields best RPS/Brier/log-loss", () => {
    const pred = { home: 1, draw: 0, away: 0 };
    expect(rankedProbabilityScore(pred, "home")).toBeCloseTo(0, 10);
    expect(brierScore(pred, "home")).toBeCloseTo(0, 10);
    expect(logLoss(pred, "home")).toBeCloseTo(0, 5);
  });

  it("uniform prediction is worse than confident correct call", () => {
    const uniform = { home: 1 / 3, draw: 1 / 3, away: 1 / 3 };
    const confident = { home: 0.7, draw: 0.2, away: 0.1 };
    expect(rankedProbabilityScore(confident, "home")).toBeGreaterThan(
      rankedProbabilityScore(uniform, "home"),
    );
  });

  it("buildValidationReport aggregates fixtures", () => {
    const report = buildValidationReport([
      { predicted: { home: 0.6, draw: 0.25, away: 0.15 }, actual: "home" },
      { predicted: { home: 0.2, draw: 0.5, away: 0.3 }, actual: "draw" },
    ]);
    expect(report.count).toBe(2);
    expect(report.rps).toBeGreaterThan(-1);
    expect(report.brier).toBeGreaterThan(0);
    expect(report.logLoss).toBeGreaterThan(0);
  });

  it("DC score matrix produces valid 1X2 probabilities", () => {
    const dist = buildScoreDistribution(1.3, 1.1, -0.13, 6);
    const probs = outcomeProbabilitiesFromScoreMatrix(dist);
    expect(probs.home + probs.draw + probs.away).toBeCloseTo(1, 6);
    expect(probs.home).toBeGreaterThan(probs.away);
  });

  it("documents external benchmark reference", () => {
    expect(SOCcer_PREDICTION_CHALLENGE_2017_BENCHMARK.rps).toBeCloseTo(0.2063, 4);
  });
});
