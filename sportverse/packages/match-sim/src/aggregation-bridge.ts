/**
 * Ratings → team-strength aggregation bridge f() — fit via regression (Engine v4 §3.2).
 */

import { getEngineCalibration } from "@sportverse/sports-db";

export interface BridgeCoefficients {
  alphaIntercept: number;
  alphaSlope: number;
  betaIntercept: number;
  betaSlope: number;
}

export interface BridgeCalibrationRow {
  attackSignal: number;
  defenseWeakness: number;
  alphaTarget: number;
  betaTarget: number;
}

export const BRIDGE_CALIBRATION_ROWS: BridgeCalibrationRow[] = [
  { attackSignal: 82, defenseWeakness: 22, alphaTarget: 0.35, betaTarget: -0.15 },
  { attackSignal: 75, defenseWeakness: 28, alphaTarget: 0.18, betaTarget: -0.05 },
  { attackSignal: 68, defenseWeakness: 32, alphaTarget: 0.05, betaTarget: 0.05 },
  { attackSignal: 62, defenseWeakness: 38, alphaTarget: -0.08, betaTarget: 0.12 },
  { attackSignal: 55, defenseWeakness: 45, alphaTarget: -0.22, betaTarget: 0.28 },
  { attackSignal: 48, defenseWeakness: 52, alphaTarget: -0.35, betaTarget: 0.42 },
];

function fitLinear(xs: number[], ys: number[]): { intercept: number; slope: number } {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) ** 2;
  }
  const slope = den > 1e-9 ? num / den : 0;
  const intercept = my - slope * mx;
  return { intercept, slope };
}

export function fitAggregationBridge(
  rows: BridgeCalibrationRow[] = BRIDGE_CALIBRATION_ROWS,
): BridgeCoefficients {
  const attackNorm = rows.map((r) => (r.attackSignal - 65) / 20);
  const defNorm = rows.map((r) => (r.defenseWeakness - 35) / 20);
  const alphaFit = fitLinear(attackNorm, rows.map((r) => r.alphaTarget));
  const betaFit = fitLinear(defNorm, rows.map((r) => r.betaTarget));
  return {
    alphaIntercept: alphaFit.intercept,
    alphaSlope: alphaFit.slope,
    betaIntercept: betaFit.intercept,
    betaSlope: betaFit.slope,
  };
}

export const DEFAULT_BRIDGE_COEFFICIENTS: BridgeCoefficients = fitAggregationBridge();

/** Runtime bridge coefficients — archive-fitted when engine-calibration.json is loaded. */
export function getBridgeCoefficients(): BridgeCoefficients {
  const cal = getEngineCalibration();
  if (cal.version > 0) return cal.aggregationBridge;
  return DEFAULT_BRIDGE_COEFFICIENTS;
}

export function bridgeCalibrationMae(
  coeffs: BridgeCoefficients,
  rows: BridgeCalibrationRow[] = BRIDGE_CALIBRATION_ROWS,
): { alphaMae: number; betaMae: number } {
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
