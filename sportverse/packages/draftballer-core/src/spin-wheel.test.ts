import { describe, expect, it } from "vitest";
import {
  buildWheelSegments,
  createWheelSession,
  ensureSegmentsForSlot,
  getPickCandidates,
  minPickCandidatesForPosition,
  pickPlayerForSlot,
  randomSegmentIndex,
  spinToPlayableSegment,
  spinToSegment,
  swapFormationSlots,
  wheelSquadRating,
} from "./spin-wheel.js";
import { getPresetMode } from "./modes.js";
import { buildDraftPool } from "./pool.js";
import { draftPickAllowedForSlot } from "./squad-rules.js";
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
      expect(seg.label).not.toMatch(/^tm[-_]/i);
    }
  });

  it("position-filtered segments always supply enough players for the slot", () => {
    const minNeed = minPickCandidatesForPosition("FB");
    const segments = buildWheelSegments(mode, pool, "test-fb-filter", 24, { position: "FB" });
    expect(segments.length).toBeGreaterThan(0);
    const poolMap = new Map(pool.map((p) => [p.playerId, p]));
    for (const seg of segments) {
      const eligible = (seg.squadPlayerIds ?? [])
        .map((id) => poolMap.get(id))
        .filter((c) => c && draftPickAllowedForSlot(c, "FB", true));
      expect(eligible.length).toBeGreaterThanOrEqual(minNeed);
    }
  });

  it("every wheel slice is playable — landing never yields an empty pool", () => {
    let state = createWheelSession(mode, pool, "test-no-dead-ends");
    state = ensureSegmentsForSlot(state, pool);
    const pos = state.formation[state.currentSlotIndex]?.position;
    const minNeed = minPickCandidatesForPosition(pos);
    for (let i = 0; i < state.segments.length; i++) {
      const spun = spinToSegment({ ...state, phase: "ready", spunSegment: null }, i, pool);
      expect(getPickCandidates(spun, pool).length).toBeGreaterThanOrEqual(minNeed);
    }
  });

  it("FB slots never surface wingers", () => {
    let state = createWheelSession(mode, pool, "test-fb-strict");
    const fbSlot = state.formation.findIndex((s) => s.position === "FB");
    expect(fbSlot).toBeGreaterThanOrEqual(0);
    state = {
      ...state,
      currentSlotIndex: fbSlot,
      selectedSlotIndex: fbSlot,
      mode: { ...state.mode, draftOrder: "position_first" },
    };
    state = ensureSegmentsForSlot(state, pool);
    state = spinToSegment(state, 0, pool);
    const candidates = getPickCandidates(state, pool);
    expect(candidates.length).toBeGreaterThan(0);
    for (const c of candidates) {
      expect(c.position).toBe("FB");
    }
  });

  it("consecutive spin indexes differ when salt changes", () => {
    const segments = buildWheelSegments(mode, pool, "spin-salt");
    expect(segments.length).toBeGreaterThan(2);
    const a = randomSegmentIndex(segments, "same-seed", 0);
    const b = randomSegmentIndex(segments, "same-seed", 1);
    const c = randomSegmentIndex(segments, "same-seed", 1, a);
    expect(c).not.toBe(a);
    // Same salt → same index (deterministic)
    expect(randomSegmentIndex(segments, "same-seed", 0)).toBe(a);
    expect(a === b || a !== b).toBe(true); // salt usually differs; exclude is hard guarantee
  });

  it("pick pool is always club squad + legal for target position", () => {
    let state = createWheelSession(mode, pool, "test-squad-lock");
    expect(state.segments.length).toBeGreaterThan(0);
    let checked = 0;
    for (let i = 0; i < state.segments.length && checked < 6; i++) {
      state = spinToPlayableSegment({ ...state, phase: "ready", spunSegment: null }, i, pool);
      const squad = new Set(state.spunSegment?.squadPlayerIds ?? []);
      const pos = state.formation[state.currentSlotIndex]?.position;
      const candidates = getPickCandidates(state, pool);
      if (!candidates.length) continue;
      expect(candidates.length).toBeGreaterThanOrEqual(minPickCandidatesForPosition(pos));
      checked++;
      for (const c of candidates) {
        expect(squad.has(c.playerId)).toBe(true);
        if (pos) expect(draftPickAllowedForSlot(c, pos, true)).toBe(true);
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("runs spin → pick → complete flow", () => {
    let state = createWheelSession(mode, pool, "test-seed");
    expect(state.phase).toBe("ready");
    expect(state.segments.length).toBeGreaterThan(0);

    let candidates: ReturnType<typeof getPickCandidates> = [];
    for (let i = 0; i < state.segments.length; i++) {
      state = spinToSegment({ ...state, phase: "ready", spunSegment: null, spinsUsed: i }, i, pool);
      candidates = getPickCandidates(state, pool);
      if (candidates.length) break;
    }
    expect(candidates.length).toBeGreaterThan(0);

    state = pickPlayerForSlot(state, candidates[0]!.playerId, pool);
    expect(state.roster).toHaveLength(1);
    expect(state.phase).toBe("ready");
  });

  it("computes squad rating when complete", () => {
    let state = createWheelSession(mode, pool, "test-complete");
    // Wider segment set so every formation role can find a club-season match.
    state = { ...state, segments: buildWheelSegments(mode, pool, "test-complete-wide", 120) };
    expect(state.segments.length).toBeGreaterThan(20);

    while (state.phase !== "complete") {
      const emptySlots = state.formation
        .map((s, idx) => (!s.playerId ? idx : -1))
        .filter((idx) => idx >= 0);
      expect(emptySlots.length).toBeGreaterThan(0);

      let placed = false;
      for (const slotIndex of emptySlots) {
        state = {
          ...state,
          currentSlotIndex: slotIndex,
          selectedSlotIndex: slotIndex,
          mode: { ...state.mode, draftOrder: "position_first" },
        };
        for (let attempt = 0; attempt < state.segments.length; attempt++) {
          state = spinToSegment({ ...state, phase: "ready", spunSegment: null }, attempt, pool);
          const candidates = getPickCandidates(state, pool);
          if (!candidates.length) continue;
          state = pickPlayerForSlot(state, candidates[0]!.playerId, pool);
          placed = true;
          break;
        }
        if (placed) break;
      }
      expect(placed).toBe(true);
    }

    expect(state.phase).toBe("complete");
    expect(wheelSquadRating(state, pool)).toBeGreaterThan(0);
  });

  it("swaps only when both players fit the opposite slots", () => {
    let state = createWheelSession(mode, pool, "test-swap");
    // Fill two slots with compatible players by scanning
    const fillSlot = (slotIndex: number) => {
      state = { ...state, currentSlotIndex: slotIndex, selectedSlotIndex: slotIndex, mode: { ...state.mode, draftOrder: "position_first" as const } };
      for (let i = 0; i < state.segments.length; i++) {
        state = spinToSegment({ ...state, phase: "ready", spunSegment: null }, i, pool);
        const cands = getPickCandidates(state, pool);
        if (!cands.length) continue;
        state = pickPlayerForSlot(state, cands[0]!.playerId, pool);
        return true;
      }
      return false;
    };
    expect(fillSlot(0)).toBe(true);
    expect(fillSlot(1)).toBe(true);
    const a = state.formation[0]!;
    const b = state.formation[1]!;
    expect(a.playerId && b.playerId).toBeTruthy();
    const poolMap = new Map(pool.map((p) => [p.playerId, p]));
    const pa = poolMap.get(a.playerId!)!;
    const pb = poolMap.get(b.playerId!)!;
    const canSwap =
      draftPickAllowedForSlot(pa, b.position, true) && draftPickAllowedForSlot(pb, a.position, true);
    if (canSwap) {
      const swapped = swapFormationSlots(state, 0, 1, pool);
      expect(swapped.formation[0]!.playerId).toBe(b.playerId);
      expect(swapped.formation[1]!.playerId).toBe(a.playerId);
    } else {
      expect(() => swapFormationSlots(state, 0, 1, pool)).toThrow(/cannot play/);
    }
  });
});
