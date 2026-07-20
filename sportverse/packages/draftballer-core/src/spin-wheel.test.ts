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
import { looksLikeJunkClubAlias } from "@sportverse/sports-db";

describe("spin-wheel", () => {
  const mode = getPresetMode("all-time-any");
  const pool = buildDraftPool(mode);

  it("builds wheel segments from recognizable club-seasons only", () => {
    const segments = buildWheelSegments(mode, pool, "test-segments");
    expect(segments.length).toBeGreaterThanOrEqual(6);
    expect(segments.length).toBeLessThanOrEqual(24);
    expect(segments[0]?.label).toBeTruthy();
    for (const seg of segments) {
      expect(seg.squadPlayerIds?.length).toBeGreaterThanOrEqual(14);
      expect(looksLikeJunkClubAlias(seg.label)).toBe(false);
      expect(seg.label).not.toMatch(/^ZB\s/i);
    }
  });

  it("pick pool is always subset of landed club squad", () => {
    let state = createWheelSession(mode, pool, "test-squad-lock");
    expect(state.segments.length).toBeGreaterThan(0);
    for (let i = 0; i < Math.min(8, state.segments.length); i++) {
      state = spinToSegment({ ...state, phase: "ready", spunSegment: null }, i, pool);
      const squad = new Set(state.spunSegment?.squadPlayerIds ?? []);
      expect(squad.size).toBeGreaterThan(0);
      const candidates = getPickCandidates(state, pool);
      expect(candidates.length).toBeGreaterThan(0);
      for (const c of candidates) {
        expect(squad.has(c.playerId)).toBe(true);
      }
    }
  });

  it("runs spin → pick → complete flow", () => {
    let state = createWheelSession(mode, pool, "test-seed");
    expect(state.phase).toBe("ready");
    expect(state.segments.length).toBeGreaterThan(0);

    state = spinToSegment(state, 0, pool);
    expect(state.phase).toBe("picking");
    expect(state.spunSegment).toBeTruthy();

    const candidates = getPickCandidates(state, pool);
    expect(candidates.length).toBeGreaterThan(0);

    state = pickPlayerForSlot(state, candidates[0]!.playerId, pool);
    expect(state.roster).toHaveLength(1);
    expect(state.phase).toBe("ready");
  });

  it("computes squad rating when complete", () => {
    let state = createWheelSession(mode, pool, "test-complete");

    for (let i = 0; i < state.squadSize; i++) {
      state = spinToSegment(state, i % state.segments.length, pool);
      const candidates = getPickCandidates(state, pool);
      expect(candidates.length).toBeGreaterThan(0);
      state = pickPlayerForSlot(state, candidates[0]!.playerId, pool);
    }

    expect(state.phase).toBe("complete");
    expect(wheelSquadRating(state, pool)).toBeGreaterThan(0);
  });
});
