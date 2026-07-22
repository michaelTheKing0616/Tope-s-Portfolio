import { describe, expect, it } from "vitest";
import { createRng } from "./rng.js";
import {
  chaseIntensity,
  dueGoalSlot,
  isBigChance,
  sampleChanceXg,
  scheduleGoalMinutes,
  summarizeMatchStats,
  emptyPhaseStats,
} from "./chance-model.js";

describe("chance-model", () => {
  it("schedules goals across the match, not all at 89'", () => {
    const rng = createRng("chance-schedule-v1");
    const minutes = scheduleGoalMinutes(4, rng);
    expect(minutes).toHaveLength(4);
    expect(minutes.every((m) => m >= 6 && m <= 88)).toBe(true);
    expect(minutes[0]!).toBeLessThanOrEqual(minutes[minutes.length - 1]!);
    // At least one before the final 10'
    expect(minutes.some((m) => m < 80)).toBe(true);
  });

  it("marks big chances from xG threshold", () => {
    expect(isBigChance(0.31)).toBe(false);
    expect(isBigChance(0.32)).toBe(true);
  });

  it("samples bounded hidden xG", () => {
    const rng = createRng("xg-sample-v1");
    for (let i = 0; i < 40; i++) {
      const xg = sampleChanceXg({
        attack: 78,
        defense: 70,
        gk: 72,
        zoneMod: 0.1,
        momentumBoost: 1.05,
        identityBias: 0.02,
        rng,
      });
      expect(xg).toBeGreaterThanOrEqual(0.04);
      expect(xg).toBeLessThanOrEqual(0.72);
    }
  });

  it("increases chase intensity when trailing late", () => {
    expect(chaseIntensity(-2, 78)).toBeGreaterThan(chaseIntensity(-1, 40));
    expect(chaseIntensity(1, 80)).toBeLessThan(0);
  });

  it("detects due goal slots", () => {
    const slots = [22, 55];
    expect(dueGoalSlot(slots, 20)).toBe(true);
    expect(dueGoalSlot([55], 40)).toBe(false);
  });

  it("summarizes possession and xG", () => {
    const stats = emptyPhaseStats();
    stats.possessionHomePhases = 55;
    stats.possessionAwayPhases = 45;
    stats.xGHome = 1.84;
    stats.xGAway = 0.91;
    stats.shotsHome = 12;
    stats.shotsAway = 7;
    const s = summarizeMatchStats(stats);
    expect(s.possessionHome).toBe(55);
    expect(s.xGHome).toBe(1.84);
    expect(s.shotsAway).toBe(7);
  });
});
