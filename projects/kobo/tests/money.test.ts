import { describe, expect, it } from "vitest";
import { formatNaira, nairaToKobo, sumKobo } from "../src/money.js";

describe("money", () => {
  it("converts naira to kobo as integers", () => {
    expect(nairaToKobo(62000)).toBe(6_200_000);
    expect(nairaToKobo(0.01)).toBe(1);
  });

  it("formats kobo as Naira strings", () => {
    expect(formatNaira(186_000_00)).toContain("186,000.00");
  });

  it("sums kobo without floats", () => {
    expect(sumKobo([100, 200, 300])).toBe(600);
  });
});
