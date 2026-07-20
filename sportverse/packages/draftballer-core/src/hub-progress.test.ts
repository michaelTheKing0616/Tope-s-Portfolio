import { describe, expect, it } from "vitest";
import { featuredModeForDate, isoWeekNumber } from "./hub-progress.js";
import { PRESET_MODES } from "./modes.js";

describe("hub progress — Phase 5", () => {
  it("isoWeekNumber: 2026-01-05 (Mon) is ISO week 2", () => {
    // 2026-01-01 is Thursday → week 1; 2026-01-05 is Monday of week 2.
    expect(isoWeekNumber(new Date("2026-01-05T12:00:00Z"))).toBe(2);
  });

  it("featuredModeForDate is deterministic for a fixed ISO week", () => {
    const a = featuredModeForDate(new Date("2026-07-20T12:00:00Z"));
    const b = featuredModeForDate(new Date("2026-07-22T12:00:00Z")); // same ISO week
    expect(a.id).toBe(b.id);
    expect(PRESET_MODES.some((m) => m.id === a.id)).toBe(true);
    expect(a.id).not.toBe("custom");
  });
});
