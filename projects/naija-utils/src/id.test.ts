import { describe, it, expect } from "vitest";
import { isValidNIN, isValidBVN, maskID } from "./id.js";

describe("ID validation (format-level)", () => {
  it("accepts 11-digit NIN and BVN", () => {
    expect(isValidNIN("12345678901")).toBe(true);
    expect(isValidBVN("22123456789")).toBe(true);
  });

  it("rejects wrong lengths and non-digits", () => {
    for (const bad of ["1234567890", "123456789012", "1234567890a", ""]) {
      expect(isValidNIN(bad)).toBe(false);
      expect(isValidBVN(bad)).toBe(false);
    }
  });

  it("trims surrounding whitespace", () => {
    expect(isValidNIN("  12345678901 ")).toBe(true);
  });
});

describe("maskID", () => {
  it("masks all but the last N digits", () => {
    expect(maskID("12345678901")).toBe("*******8901");
    expect(maskID("12345678901", 2)).toBe("*********01");
  });

  it("throws on malformed input", () => {
    expect(() => maskID("123")).toThrowError(/11-digit/);
  });
});
