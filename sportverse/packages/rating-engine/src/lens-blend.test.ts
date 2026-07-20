import { describe, expect, it } from "vitest";
import { lensBlend } from "./lens-blend.js";

describe("lensBlend", () => {
  it("club_only ignores blend factor", () => {
    expect(lensBlend(88, 72, "club_only", 0)).toBe(88);
    expect(lensBlend(88, 72, "club_only", 0.5)).toBe(88);
    expect(lensBlend(88, 72, "club_only", 1)).toBe(88);
  });

  it("international_only ignores blend factor", () => {
    expect(lensBlend(88, 72, "international_only", 0)).toBe(72);
    expect(lensBlend(88, 72, "international_only", 0.5)).toBe(72);
  });

  it("blended interpolates between club and intl raws", () => {
    const club = lensBlend(88, 72, "blended", 0);
    const mid = lensBlend(88, 72, "blended", 0.5);
    const intl = lensBlend(88, 72, "blended", 1);
    expect(club).toBe(88);
    expect(intl).toBe(72);
    expect(mid).toBeGreaterThan(intl);
    expect(mid).toBeLessThan(club);
  });
});
