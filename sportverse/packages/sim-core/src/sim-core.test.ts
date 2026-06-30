import { describe, expect, it } from "vitest";
import { resolveDecision, getScenario } from "../src/football-iq.js";
import { resolveSave, getGoalkeeperLevel, GOALKEEPER_LEVELS } from "../src/goalkeeper.js";

describe("football-iq", () => {
  it("resolves decisions with explanations", () => {
    const s = getScenario("fiq-1");
    expect(s).toBeDefined();
    const result = resolveDecision(s!, "shoot");
    expect(result.wasOptimal).toBe(true);
    expect(result.explanation).toBeTruthy();
  });

  it("flags suboptimal choices", () => {
    const s = getScenario("fiq-1");
    const result = resolveDecision(s!, "through_ball");
    expect(result.wasOptimal).toBe(false);
    expect(result.explanation).toContain("Better choice");
  });
});

describe("goalkeeper", () => {
  it("has 20 levels", () => {
    expect(GOALKEEPER_LEVELS).toHaveLength(20);
  });

  it("resolves saves", () => {
    const level = getGoalkeeperLevel(1)!;
    const result = resolveSave(level, "right");
    expect(result.saved).toBe(true);
    expect(result.xpEarned).toBeGreaterThan(0);
  });
});
