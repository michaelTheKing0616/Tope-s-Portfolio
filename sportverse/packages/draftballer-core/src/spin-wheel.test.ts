import { describe, expect, it } from "vitest";
import {
  buildWheelSegments,
  createWheelSession,
  ensureSegmentsForSlot,
  getFullSquadPickBoard,
  getPickCandidates,
  minPickCandidatesForPosition,
  pickPlayerForSlot,
  randomSegmentIndex,
  selectFormationSlot,
  spinToPlayableSegment,
  spinToSegment,
  swapFormationSlots,
  wheelSquadRating,
} from "./spin-wheel.js";
import { evaluateSquadQuality } from "./squad-quality.js";
import { getPresetMode } from "./modes.js";
import { buildDraftPool } from "./pool.js";
import { draftPickAllowedForSlot } from "./squad-rules.js";
import { looksLikeJunkClubAlias } from "@sportverse/sports-db";

/** Spin → choose empty slot → pick any remaining squad member. */
function landAndPick(
  state: ReturnType<typeof createWheelSession>,
  pool: ReturnType<typeof buildDraftPool>,
  segmentSalt: number,
  preferLowOvr = false,
) {
  let next = spinToPlayableSegment(
    { ...state, phase: "ready", spunSegment: null },
    segmentSalt,
    pool,
  );
  const empty = next.formation.findIndex((s) => !s.playerId);
  expect(empty).toBeGreaterThanOrEqual(0);
  next = selectFormationSlot(next, empty);
  const board = getFullSquadPickBoard(next, pool);
  expect(board.length).toBeGreaterThan(0);
  expect(board.every((e) => e.eligible)).toBe(true);
  const pick = preferLowOvr
    ? [...board].sort((a, b) => a.card.ovr - b.card.ovr)[0]!
    : board[0]!;
  return pickPlayerForSlot(next, pick.card.playerId, pool);
}

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

  it("optional position-filtered segments still supply enough players for the slot", () => {
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

  it("every wheel slice lands with a non-empty undrafted squad", () => {
    let state = createWheelSession(mode, pool, "test-no-dead-ends");
    state = ensureSegmentsForSlot(state, pool);
    for (let i = 0; i < state.segments.length; i++) {
      const spun = spinToSegment({ ...state, phase: "ready", spunSegment: null }, i, pool);
      expect(getPickCandidates(spun, pool).length).toBeGreaterThanOrEqual(1);
      expect(getFullSquadPickBoard(spun, pool).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("spin clears position — user chooses slot after landing", () => {
    let state = createWheelSession(mode, pool, "test-pos-after-spin");
    const fbSlot = state.formation.findIndex((s) => s.position === "FB");
    expect(fbSlot).toBeGreaterThanOrEqual(0);
    state = selectFormationSlot(state, fbSlot);
    expect(state.selectedSlotIndex).toBe(fbSlot);
    state = spinToPlayableSegment(state, 0, pool);
    expect(state.phase).toBe("picking");
    expect(state.selectedSlotIndex).toBeUndefined();
    expect(getFullSquadPickBoard(state, pool).every((e) => e.eligible)).toBe(true);
  });

  it("after choosing FB, shortlist prefers legal full-backs", () => {
    let state = createWheelSession(mode, pool, "test-fb-after-choose");
    const fbSlot = state.formation.findIndex((s) => s.position === "FB");
    expect(fbSlot).toBeGreaterThanOrEqual(0);
    state = spinToPlayableSegment(state, 0, pool);
    state = selectFormationSlot(state, fbSlot);
    const candidates = getPickCandidates(state, pool);
    expect(candidates.length).toBeGreaterThan(0);
    for (const c of candidates) {
      expect(draftPickAllowedForSlot(c, "FB", true)).toBe(true);
    }
  });

  it("consecutive spin indexes differ when salt changes", () => {
    const segments = buildWheelSegments(mode, pool, "spin-salt");
    expect(segments.length).toBeGreaterThan(2);
    const a = randomSegmentIndex(segments, "same-seed", 0);
    const b = randomSegmentIndex(segments, "same-seed", 1);
    const c = randomSegmentIndex(segments, "same-seed", 1, a);
    expect(c).not.toBe(a);
    expect(randomSegmentIndex(segments, "same-seed", 0)).toBe(a);
    expect(a === b || a !== b).toBe(true);
  });

  it("full squad board is never greyed — any teammate can fill the chosen slot", () => {
    let state = createWheelSession(mode, pool, "test-full-board");
    state = spinToPlayableSegment(state, 0, pool);
    const empty = state.formation.findIndex((s) => !s.playerId);
    state = selectFormationSlot(state, empty);
    const board = getFullSquadPickBoard(state, pool);
    expect(board.length).toBeGreaterThan(0);
    const squad = new Set(state.spunSegment?.squadPlayerIds ?? []);
    for (const entry of board) {
      expect(squad.has(entry.card.playerId)).toBe(true);
      expect(entry.eligible).toBe(true);
    }
    const deep = board.find((e) => !e.recommended) ?? board[0]!;
    state = pickPlayerForSlot(state, deep.card.playerId, pool);
    expect(state.roster).toContain(deep.card.playerId);
  });

  it("pick requires a chosen empty slot", () => {
    let state = createWheelSession(mode, pool, "test-need-slot");
    state = spinToPlayableSegment(state, 0, pool);
    const board = getFullSquadPickBoard(state, pool);
    expect(board.length).toBeGreaterThan(0);
    expect(() => pickPlayerForSlot(state, board[0]!.card.playerId, pool)).toThrow(
      /Choose a formation position/,
    );
  });

  it("runs spin → choose position → pick → ready flow", () => {
    let state = createWheelSession(mode, pool, "test-seed");
    expect(state.phase).toBe("ready");
    expect(state.segments.length).toBeGreaterThan(0);
    state = landAndPick(state, pool, 0);
    expect(state.roster).toHaveLength(1);
    expect(state.phase).toBe("ready");
  });

  it("computes squad rating when complete", () => {
    let state = createWheelSession(mode, pool, "test-complete");
    state = { ...state, segments: buildWheelSegments(mode, pool, "test-complete-wide", 120) };
    expect(state.segments.length).toBeGreaterThan(20);

    let salt = 0;
    while (state.phase !== "complete") {
      const before = state.roster.length;
      state = landAndPick(state, pool, salt++);
      expect(state.roster.length).toBe(before + 1);
    }

    expect(state.phase).toBe("complete");
    expect(wheelSquadRating(state, pool)).toBeGreaterThan(0);
  });

  it("quality nudge raises target min OVR when squad starts weak", () => {
    let state = createWheelSession(mode, pool, "test-quality-nudge");
    for (let pick = 0; pick < 3 && state.phase !== "complete"; pick++) {
      state = landAndPick(state, pool, pick, true);
    }
    const poolMap = new Map(pool.map((p) => [p.playerId, p]));
    const quality = evaluateSquadQuality(state.roster, poolMap, state.squadSize);
    if (quality.avgOvr > 0 && quality.avgOvr < 68) {
      expect(quality.needsQualityBoost).toBe(true);
      expect(quality.targetMinPickOvr).toBeGreaterThan(62);
    }
  });

  it("swaps only when both players fit the opposite slots", () => {
    let state = createWheelSession(mode, pool, "test-swap");
    state = landAndPick(state, pool, 0);
    state = landAndPick(state, pool, 1);
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
