import { describe, it, expect } from "vitest";
import { parsePhone, isValidPhone, getNetwork, formatPhone } from "./phone.js";

describe("parsePhone", () => {
  it("normalises all common input formats to the same canonical number", () => {
    const inputs = [
      "08031234567",
      "+2348031234567",
      "2348031234567",
      "08031234567 ",
      "0803 123 4567",
      "0803-123-4567",
      "8031234567",
    ];
    for (const input of inputs) {
      const parsed = parsePhone(input);
      expect(parsed).not.toBeNull();
      expect(parsed?.local).toBe("08031234567");
      expect(parsed?.e164).toBe("+2348031234567");
    }
  });

  it("detects networks from their prefixes", () => {
    expect(getNetwork("08031234567")).toBe("MTN");
    expect(getNetwork("08051234567")).toBe("Glo");
    expect(getNetwork("08021234567")).toBe("Airtel");
    expect(getNetwork("08091234567")).toBe("9mobile");
  });

  it("returns Unknown for a valid shape with an unallocated prefix", () => {
    // 0700 is valid in shape (starts with 7) but not an allocated mobile prefix.
    const parsed = parsePhone("07001234567");
    expect(parsed?.network).toBe("Unknown");
  });

  it("rejects invalid numbers", () => {
    for (const bad of ["", "1234", "0123456789", "0603123456", "notaphone", "080312345678"]) {
      expect(parsePhone(bad)).toBeNull();
      expect(isValidPhone(bad)).toBe(false);
    }
  });
});

describe("formatPhone", () => {
  it("formats to e164 and local", () => {
    expect(formatPhone("08031234567", "e164")).toBe("+2348031234567");
    expect(formatPhone("+2348031234567", "local")).toBe("08031234567");
  });

  it("throws on invalid input so boundaries fail loudly", () => {
    expect(() => formatPhone("nope")).toThrowError(/Invalid Nigerian phone/);
  });
});
