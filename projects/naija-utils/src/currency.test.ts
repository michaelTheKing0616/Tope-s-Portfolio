import { describe, it, expect } from "vitest";
import { nairaToKobo, koboToNaira, formatNaira } from "./currency.js";

describe("kobo conversions", () => {
  it("round-trips naira through kobo without float drift", () => {
    expect(nairaToKobo(186000)).toBe(18600000);
    expect(nairaToKobo(0.1 + 0.2)).toBe(30); // would be 30.0000004 naively
    expect(koboToNaira(18600000)).toBe(186000);
  });

  it("rejects non-integer kobo", () => {
    expect(() => koboToNaira(10.5)).toThrowError(/integer/);
  });
});

describe("formatNaira", () => {
  it("formats whole and fractional amounts with grouping", () => {
    expect(formatNaira(186000)).toBe("\u20A6186,000.00");
    expect(formatNaira(37000, { decimals: 0 })).toBe("\u20A637,000");
  });

  it("supports kobo input and symbol toggle", () => {
    expect(formatNaira(18600000, { fromKobo: true, decimals: 0 })).toBe("\u20A6186,000");
    expect(formatNaira(186000, { symbol: false })).toBe("186,000.00");
  });

  it("handles negative amounts", () => {
    expect(formatNaira(-2500, { decimals: 0 })).toContain("2,500");
  });
});
