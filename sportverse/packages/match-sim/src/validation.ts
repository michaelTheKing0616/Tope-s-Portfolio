/**
 * Football forecasting validation metrics — Engine v4 §4.
 */

export type MatchOutcome = "home" | "draw" | "away";

export interface OutcomeProbabilities {
  home: number;
  draw: number;
  away: number;
}

/** Ranked Probability Score for 3-outcome forecasts (§4.1). */
export function rankedProbabilityScore(
  predicted: OutcomeProbabilities,
  actual: MatchOutcome,
): number {
  const cum = {
    home: predicted.home,
    draw: predicted.home + predicted.draw,
    away: 1,
  };
  const actualCum =
    actual === "home" ? cum.home : actual === "draw" ? cum.draw : cum.away;
  let score = actualCum - 0.5 * predicted[actual] - 0.5;
  if (actual === "draw") {
    score -= 0.5 * (predicted.home ** 2 + predicted.away ** 2);
  }
  return score / 2;
}

/** Multi-class Brier score for 1X2. */
export function brierScore(predicted: OutcomeProbabilities, actual: MatchOutcome): number {
  const actualVec = {
    home: actual === "home" ? 1 : 0,
    draw: actual === "draw" ? 1 : 0,
    away: actual === "away" ? 1 : 0,
  };
  return (
    (predicted.home - actualVec.home) ** 2 +
    (predicted.draw - actualVec.draw) ** 2 +
    (predicted.away - actualVec.away) ** 2
  );
}

/** Log-loss for 1X2 (clamped for numerical stability). */
export function logLoss(predicted: OutcomeProbabilities, actual: MatchOutcome): number {
  const p = Math.max(1e-15, Math.min(1 - 1e-15, predicted[actual]));
  return -Math.log(p);
}

/** Derive 1X2 probabilities from Dixon–Coles score distribution. */
export function outcomeProbabilitiesFromScoreMatrix(
  cells: { home: number; away: number; prob: number }[],
): OutcomeProbabilities {
  let home = 0;
  let draw = 0;
  let away = 0;
  for (const c of cells) {
    if (c.home > c.away) home += c.prob;
    else if (c.home === c.away) draw += c.prob;
    else away += c.prob;
  }
  return { home, draw, away };
}

export interface ValidationReport {
  count: number;
  rps: number;
  brier: number;
  logLoss: number;
  accuracy: number;
}

export interface ScoredFixture {
  predicted: OutcomeProbabilities;
  actual: MatchOutcome;
}

export function buildValidationReport(fixtures: ScoredFixture[]): ValidationReport {
  if (!fixtures.length) {
    return { count: 0, rps: 0, brier: 0, logLoss: 0, accuracy: 0 };
  }
  let rpsSum = 0;
  let brierSum = 0;
  let logSum = 0;
  let correct = 0;
  for (const f of fixtures) {
    rpsSum += rankedProbabilityScore(f.predicted, f.actual);
    brierSum += brierScore(f.predicted, f.actual);
    logSum += logLoss(f.predicted, f.actual);
    const pick: MatchOutcome =
      f.predicted.home >= f.predicted.draw && f.predicted.home >= f.predicted.away
        ? "home"
        : f.predicted.draw >= f.predicted.away
          ? "draw"
          : "away";
    if (pick === f.actual) correct++;
  }
  const n = fixtures.length;
  return {
    count: n,
    rps: rpsSum / n,
    brier: brierSum / n,
    logLoss: logSum / n,
    accuracy: correct / n,
  };
}

/** Published 2017 Soccer Prediction Challenge reference (§4.2). */
export const SOCcer_PREDICTION_CHALLENGE_2017_BENCHMARK = {
  rps: 0.2063,
  accuracy: 0.5243,
} as const;
