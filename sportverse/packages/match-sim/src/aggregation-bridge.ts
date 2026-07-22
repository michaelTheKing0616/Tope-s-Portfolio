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
  // Steeper curve — real strength gaps must produce decisive scorelines.
  // Hand-check: 86-OVR side (signal≈85, α≈0.55) vs 61-OVR side (defWeak≈42, β≈+0.28)
  // → λ = exp(0.25+0.55+0.28) ≈ 2.94; their μ = exp(-0.42-0.38) ≈ 0.45 → ~85% win.
  { attackSignal: 88, defenseWeakness: 14, alphaTarget: 0.6, betaTarget: -0.42 },
  { attackSignal: 82, defenseWeakness: 20, alphaTarget: 0.4, betaTarget: -0.28 },
  { attackSignal: 76, defenseWeakness: 26, alphaTarget: 0.22, betaTarget: -0.13 },
  { attackSignal: 71, defenseWeakness: 31, alphaTarget: 0.03, betaTarget: 0.0 },
  { attackSignal: 65, defenseWeakness: 37, alphaTarget: -0.2, betaTarget: 0.15 },
  { attackSignal: 58, defenseWeakness: 44, alphaTarget: -0.46, betaTarget: 0.33 },
  { attackSignal: 50, defenseWeakness: 52, alphaTarget: -0.76, betaTarget: 0.53 },
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

/**
 * Archive ETL sometimes fits a crushing β intercept that collapses λ/μ toward
 * identical floors → draw inflation (~33%+) and ~1.7 GPG. Reject those fits.
 */
export function bridgeCoefficientsHealthy(coeffs: BridgeCoefficients): boolean {
  return coeffs.betaIntercept > -0.55 && coeffs.alphaIntercept > -0.48 && coeffs.alphaSlope > 0.35;
}

/** Runtime bridge — prefer archive fit only when it keeps mid-table rates healthy. */
export function getBridgeCoefficients(): BridgeCoefficients {
  const cal = getEngineCalibration();
  if (cal.version > 0 && bridgeCoefficientsHealthy(cal.aggregationBridge)) {
    return cal.aggregationBridge;
  }
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
