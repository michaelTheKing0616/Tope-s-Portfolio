import { describe, expect, it } from "vitest";
import { intBetween, mulberry32, weightedPick } from "./rng";
import { goldRamp } from "./renderer";

describe("mulberry32", () => {
  it("is deterministic and in range [0,1)", () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    for (let i = 0; i < 50; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("intBetween", () => {
  it("stays within the inclusive bounds", () => {
    const r = mulberry32(5);
    for (let i = 0; i < 200; i++) {
      const n = intBetween(r, 3, 7);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(7);
    }
  });
});

describe("weightedPick", () => {
  it("never picks a zero-weight option", () => {
    const r = mulberry32(11);
    const items = ["a", "b", "c"] as const;
    for (let i = 0; i < 300; i++) {
      expect(weightedPick(r, items, [0, 1, 0])).toBe("b");
    }
  });
});

describe("goldRamp", () => {
  it("maps 0 to ink and 1 to gold", () => {
    expect(goldRamp(0)).toEqual([11, 11, 11]);
    expect(goldRamp(1)).toEqual([184, 149, 74]);
  });
});
