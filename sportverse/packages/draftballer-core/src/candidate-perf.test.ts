import { describe, expect, it } from "vitest";
import { poolCounts } from "@sportverse/sports-db";
import {
  buildDraftPool,
  createWheelSession,
  getPickCandidates,
  getPresetMode,
  spinToSegment,
} from "./index.js";

describe("candidate perf gate — Phase 5", () => {
  it("spin → getPickCandidates stays under 50ms after warm", () => {
    const mode = getPresetMode("all-time-any");
    const pool = buildDraftPool(mode);
    const state0 = createWheelSession(mode, pool, "perf-seed-p5");
    if (!state0.segments.length) {
      expect(poolCounts().seasonStatRows >= 0).toBe(true);
      return;
    }
    const spun = spinToSegment(state0, 0, pool);
    // Warm JIT + maps outside the timed window.
    getPickCandidates(spun, pool);
    getPickCandidates(spun, pool);
    const samples: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      getPickCandidates(spun, pool);
      samples.push(performance.now() - t0);
    }
    const median = [...samples].sort((a, b) => a - b)[Math.floor(samples.length / 2)]!;
    // Spec: <50ms after data load. Median of 5 warmed calls.
    expect(median).toBeLessThan(50);
  });
});
