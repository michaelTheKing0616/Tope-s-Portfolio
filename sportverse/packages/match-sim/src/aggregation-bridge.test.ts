import { describe, expect, it } from "vitest";
import {
  BRIDGE_CALIBRATION_ROWS,
  bridgeCalibrationMae,
  bridgeCoefficientsHealthy,
  DEFAULT_BRIDGE_COEFFICIENTS,
  fitAggregationBridge,
  getBridgeCoefficients,
} from "./aggregation-bridge.js";
import { setEngineCalibration } from "@sportverse/sports-db";
import { squadStrengthSignals } from "./team-strength.js";
import type { RatedPlayerCard } from "@sportverse/draftballer-types";

describe("aggregation bridge — regression fit (§3.2)", () => {
  it("rejects crushing archive β fits that inflate draws", () => {
    expect(
      bridgeCoefficientsHealthy({
        alphaIntercept: -0.53,
        alphaSlope: 0.95,
        betaIntercept: -1.12,
        betaSlope: 1.18,
      }),
    ).toBe(false);
    expect(bridgeCoefficientsHealthy(DEFAULT_BRIDGE_COEFFICIENTS)).toBe(true);

    setEngineCalibration({
      version: 1,
      fittedAt: "test",
      source: "unit",
      aggregationBridge: {
        alphaIntercept: -0.53,
        alphaSlope: 0.95,
        betaIntercept: -1.12,
        betaSlope: 1.18,
      },
      leagueBridging: {
        scalingBase: 1,
        scalingSlope: 0,
        scalingMin: 0.75,
        scalingMax: 1.15,
        shiftSlope: 0,
        shiftMin: -3,
        shiftMax: 3,
        transferSampleSize: 0,
      },
      lsi: {
        weights: { elo: 0.45, transfer: 0.15, talent: 0.15, nat: 0.25 },
        sigmaLsi: 0.08,
        shrinkageK: 30,
        holdoutAccuracy: 0.5,
      },
    });
    expect(getBridgeCoefficients()).toEqual(DEFAULT_BRIDGE_COEFFICIENTS);
    setEngineCalibration(null);
  });

  it("fit reduces MAE on calibration rows", () => {
    const coeffs = fitAggregationBridge();
    const { alphaMae, betaMae } = bridgeCalibrationMae(coeffs);
    expect(alphaMae).toBeLessThan(0.15);
    expect(betaMae).toBeLessThan(0.15);
  });

  it("elite attack signal maps to higher alpha than weak attack", () => {
    const coeffs = fitAggregationBridge();
    const elite = squadStrengthSignals(
      [mockOutfield("e1", { sho: 88, pas: 85, dri: 82 }, "ST")],
      "4-3-3",
      coeffs,
    );
    const weak = squadStrengthSignals(
      [mockOutfield("w1", { sho: 52, pas: 50, dri: 48 }, "ST")],
      "4-3-3",
      coeffs,
    );
    expect(elite.alpha).toBeGreaterThan(weak.alpha);
  });

  it("leaky defense maps to higher beta than solid defense", () => {
    const coeffs = fitAggregationBridge();
    const leaky = squadStrengthSignals(
      [mockOutfield("d1", { def: 45, phy: 50 }, "CB")],
      "4-4-2",
      coeffs,
    );
    const solid = squadStrengthSignals(
      [mockOutfield("d2", { def: 88, phy: 85 }, "CB")],
      "4-4-2",
      coeffs,
    );
    expect(leaky.beta).toBeGreaterThan(solid.beta);
  });
});

function mockOutfield(
  id: string,
  attrs: Partial<RatedPlayerCard["attributes"]>,
  position: RatedPlayerCard["position"],
): RatedPlayerCard {
  const base = { pac: 60, sho: 60, pas: 60, dri: 60, def: 60, phy: 60, ...attrs };
  const ovr = Math.round((base.pac + base.sho + base.pas + base.dri + base.def + base.phy) / 6);
  return {
    playerId: id,
    name: id,
    nationality: "Test",
    position,
    ovr,
    tier: "gold",
    attributes: base,
    confidence: 0.9,
    breakdown: { clubOvrRaw: ovr, intlOvrRaw: ovr, awardBonus: 0, lens: "club_only", blendFactor: 0 },
  };
}

describe("bridge calibration rows", () => {
  it("has minimum fixture count for regression", () => {
    expect(BRIDGE_CALIBRATION_ROWS.length).toBeGreaterThanOrEqual(5);
  });
});
