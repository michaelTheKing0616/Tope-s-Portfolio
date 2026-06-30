import { describe, expect, it } from "vitest";
import { getSimPools, POOL_SIZE } from "../src/index.js";

describe("content-gen", () => {
  it("generates skill-game pools (Football IQ + Goalkeeper)", () => {
    const pools = getSimPools(POOL_SIZE);
    expect(pools.footballIQ.length).toBeGreaterThanOrEqual(1000);
    expect(pools.goalkeeper.length).toBeGreaterThanOrEqual(1000);
  });

  it("football IQ scenarios have valid best choices", () => {
    const { footballIQ } = getSimPools(100);
    for (const s of footballIQ) {
      expect(s.options.some((o) => o.id === s.bestChoice)).toBe(true);
      expect(s.options.length).toBeGreaterThanOrEqual(3);
    }
  });
});
