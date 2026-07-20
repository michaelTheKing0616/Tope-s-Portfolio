import { describe, expect, it } from "vitest";
import { buildDraftPool } from "./pool.js";
import { getPresetMode } from "./modes.js";

/**
 * Anchor contract: hand-curated legend OVRs are exact in club-lens modes —
 * no award/longevity drift, no MV blend. Guards the expanded 380-player list.
 */
describe("legend rating anchors", () => {
  const pool = buildDraftPool(getPresetMode("all-time-any"));
  const byName = new Map(pool.map((p) => [p.name, p]));

  const expected: Array<[string, number]> = [
    ["Raheem Sterling", 89],
    ["Philipp Lahm", 90],
    ["João Cancelo", 88],
    ["Trent Alexander-Arnold", 88],
    ["Lionel Messi", 96],
    ["Zico", 94],
    ["Garrincha", 95],
  ];

  it.each(expected)("%s is anchored at exactly %i", (name, ovr) => {
    const card = byName.get(name);
    expect(card, `${name} missing from pool`).toBeTruthy();
    expect(card!.ovr).toBe(ovr);
    expect(card!.breakdown?.legendOverride).toBe(true);
  });

  it("repaired mononym names no longer carry the 'not applicable' prefix", () => {
    for (const name of byName.keys()) {
      expect(name.toLowerCase().startsWith("not applicable")).toBe(false);
    }
  });
});
