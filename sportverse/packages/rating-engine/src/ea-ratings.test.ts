import { describe, expect, it } from "vitest";
import type { PlayerAttributes } from "@sportverse/draftballer-types";
import {
  blendWithEaCalibration,
  ovrFromEaAttributes,
  EA_POSITION_WEIGHTS,
} from "./ea-ratings.js";

describe("EA FC 26 calibration", () => {
  it("EA-fitted ST weights reproduce Salah-like profile within 2 OVR", () => {
    const attrs: PlayerAttributes = { pac: 89, sho: 88, pas: 86, dri: 90, def: 45, phy: 76 };
    const ovr = ovrFromEaAttributes("W", attrs);
    expect(ovr).toBeGreaterThanOrEqual(87);
    expect(ovr).toBeLessThanOrEqual(91);
  });

  it("blend lifts stats-blind player to EA floor", () => {
    const eaEntry = {
      playerId: "joao-cancelo",
      eaId: "1",
      name: "João Cancelo",
      ovr: 84,
      eaPosition: "RB",
      quizPosition: "FB" as const,
      nationality: "Portugal",
      team: "Al-Hilal",
      league: "Saudi Pro League",
      attributes: { pac: 84, sho: 72, pas: 86, dri: 84, def: 80, phy: 74 },
    };
    const { ovr, eaOvr } = blendWithEaCalibration(68, eaEntry);
    expect(eaOvr).toBeGreaterThanOrEqual(82);
    expect(ovr).toBeGreaterThanOrEqual(eaOvr);
  });

  it("peak uplift allows stats peak above EA current snapshot", () => {
    const eaEntry = {
      playerId: "sterling",
      eaId: "1",
      name: "Raheem Sterling",
      ovr: 78,
      eaPosition: "LW",
      quizPosition: "W" as const,
      nationality: "England",
      team: "Chelsea",
      league: "Premier League",
      attributes: { pac: 88, sho: 78, pas: 80, dri: 85, def: 40, phy: 70 },
    };
    const { ovr, peakUplift } = blendWithEaCalibration(88, eaEntry);
    expect(peakUplift).toBeGreaterThan(0);
    expect(ovr).toBeGreaterThan(78);
  });

  it("ea current snapshot returns published OVR exactly", () => {
    const eaEntry = {
      playerId: "tm-121483",
      eaId: "200389",
      name: "Jan Oblak",
      ovr: 88,
      eaPosition: "GK",
      quizPosition: "GK" as const,
      nationality: "Slovenia",
      team: "Atlético de Madrid",
      league: "La Liga",
      gkAttributes: { diving: 85, handling: 90, kicking: 78, positioning: 86, reflexes: 87 },
    };
    const { ovr, eaOvr } = blendWithEaCalibration(70, eaEntry, { eaCurrentSnapshot: true });
    expect(ovr).toBe(88);
    expect(eaOvr).toBe(88);
  });

  it("prime GK gets uplift above EA current for all-time", () => {
    const eaEntry = {
      playerId: "tm-121483",
      eaId: "200389",
      name: "Jan Oblak",
      ovr: 88,
      eaPosition: "GK",
      quizPosition: "GK" as const,
      nationality: "Slovenia",
      team: "Atlético de Madrid",
      league: "La Liga",
      gkAttributes: { diving: 85, handling: 90, kicking: 78, positioning: 86, reflexes: 87 },
    };
    const { ovr, primeUplift } = blendWithEaCalibration(75, eaEntry);
    expect(primeUplift).toBeGreaterThanOrEqual(3);
    expect(ovr).toBeGreaterThanOrEqual(91);
  });

  it("EA position weights sum to ~1 for each outfield role", () => {
    for (const pos of ["ST", "W", "AM", "CM", "DM", "FB", "CB"] as const) {
      const sum = Object.values(EA_POSITION_WEIGHTS[pos]).reduce((a, b) => a + b, 0);
      expect(sum).toBeGreaterThan(0.98);
      expect(sum).toBeLessThan(1.02);
    }
  });
});
