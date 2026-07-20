import { describe, expect, it } from "vitest";
import { buildDraftPool } from "./pool.js";
import { getPresetMode } from "./modes.js";

/**
 * Regression guard for the position-enrichment fix: the archive ETL once
 * collapsed all defenders to "Defender" → CM, leaving 2 fullbacks and
 * 6 wingers in a 98k-player pool. Every outfield role must be well populated.
 */
describe("draft pool position coverage", () => {
  it("has a substantial pool for every position", () => {
    const pool = buildDraftPool(getPresetMode("all-time-any"));
    const dist: Record<string, number> = {};
    for (const p of pool) dist[p.position] = (dist[p.position] ?? 0) + 1;
    for (const pos of ["GK", "CB", "FB", "DM", "CM", "AM", "W", "ST"]) {
      expect(dist[pos] ?? 0, `${pos} pool`).toBeGreaterThan(1000);
    }
  });

  it("rates elite wingers and fullbacks above the 60s", () => {
    const pool = buildDraftPool(getPresetMode("all-time-any"));
    const byName = new Map(pool.map((p) => [p.name, p]));
    const sterling = byName.get("Raheem Sterling");
    expect(sterling?.position).toBe("W");
    expect(sterling?.ovr ?? 0).toBeGreaterThanOrEqual(78);
    const cancelo = byName.get("João Cancelo");
    expect(cancelo?.position).toBe("FB");
    expect(cancelo?.ovr ?? 0).toBeGreaterThanOrEqual(72);
  });
});
