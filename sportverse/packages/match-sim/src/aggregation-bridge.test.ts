import { describe, expect, it } from "vitest";
import {
  BRIDGE_CALIBRATION_ROWS,
  bridgeCalibrationMae,
  fitAggregationBridge,
} from "./aggregation-bridge.js";
import { squadStrengthSignals } from "./team-strength.js";
import type { RatedPlayerCard } from "@sportverse/draftballer-types";

describe("aggregation bridge — regression fit (§3.2)", () => {
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
