import { describe, expect, it } from "vitest";
import {
  buildWheelSegments,
  createWheelSession,
  getPickCandidates,
  pickPlayerForSlot,
  spinToSegment,
  wheelSquadRating,
} from "./spin-wheel.js";
import { getPresetMode } from "./modes.js";
import { buildDraftPool } from "./pool.js";

describe("spin-wheel", () => {
  const mode = getPresetMode("all-time-any");
  const pool = buildDraftPool(mode);

  it("builds wheel segments from pool clubs", () => {
    const segments = buildWheelSegments(mode, pool);
    expect(segments.length).toBeGreaterThanOrEqual(6);
    expect(segments.length).toBeLessThanOrEqual(24);
    expect(segments[0]?.label).toBeTruthy();
  });

  it("runs spin → pick → complete flow", () => {
    let state = createWheelSession(mode, pool);
    expect(state.phase).toBe("ready");
    expect(state.segments.length).toBeGreaterThan(0);

    state = spinToSegment(state, 0);
    expect(state.phase).toBe("picking");
    expect(state.spunSegment).toBeTruthy();

    const candidates = getPickCandidates(state, pool);
    expect(candidates.length).toBeGreaterThan(0);

    state = pickPlayerForSlot(state, candidates[0]!.playerId, pool);
    expect(state.roster).toHaveLength(1);
    expect(state.phase).toBe("ready");
  });

  it("computes squad rating when complete", () => {
    let state = createWheelSession(mode, pool);

    for (let i = 0; i < state.squadSize; i++) {
      state = spinToSegment(state, i % state.segments.length);
      const candidates = getPickCandidates(state, pool);
      state = pickPlayerForSlot(state, candidates[0]!.playerId, pool);
    }

    expect(state.phase).toBe("complete");
    expect(wheelSquadRating(state, pool)).toBeGreaterThan(0);
  });
});
