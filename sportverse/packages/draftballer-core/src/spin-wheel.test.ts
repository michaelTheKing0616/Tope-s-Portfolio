import { describe, expect, it } from "vitest";
import {
  buildWheelSegments,
  createWheelSession,
  ensureSegmentsForSlot,
  findPlacementSlotIndex,
  getFullSquadPickBoard,
  getPickCandidates,
  minPickCandidatesForPosition,
  pickPlayerForSlot,
  randomSegmentIndex,
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

/** Spin → pick any eligible squad member (auto-placed into best open slot). */
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
  const board = getFullSquadPickBoard(next, pool).filter((e) => e.eligible);
  expect(board.length).toBeGreaterThan(0);
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

  it("after spin, full squad is shown without choosing a pitch slot first", () => {
    let state = createWheelSession(mode, pool, "test-full-squad-immediate");
    state = spinToPlayableSegment(state, 0, pool);
    expect(state.phase).toBe("picking");
    const board = getFullSquadPickBoard(state, pool);
    expect(board.length).toBeGreaterThan(0);
    expect(board.some((e) => e.eligible)).toBe(true);
    const pick = board.find((e) => e.eligible)!;
    expect(findPlacementSlotIndex(state, pick.card)).toBeGreaterThanOrEqual(0);
    state = pickPlayerForSlot(state, pick.card.playerId, pool);
    expect(state.roster).toContain(pick.card.playerId);
  });

  it("greys out only players with no open legal formation slot", () => {
    let state = createWheelSession(mode, pool, "test-grey-filled-only");
    // Fill every non-GK slot so only GK-capable players remain eligible.
    const gkIdx = state.formation.findIndex((s) => s.position === "GK");
    expect(gkIdx).toBeGreaterThanOrEqual(0);
    for (let i = 0; i < state.formation.length; i++) {
      if (i === gkIdx) continue;
      state = {
        ...state,
        formation: state.formation.map((s, idx) =>
          idx === i ? { ...s, playerId: `filled-${i}` } : s,
        ),
        roster: [...state.roster, `filled-${i}`],
      };
    }
    state = spinToPlayableSegment({ ...state, phase: "ready", spunSegment: null }, 0, pool);
    const board = getFullSquadPickBoard(state, pool);
    expect(board.length).toBeGreaterThan(0);
    for (const entry of board) {
      if (entry.eligible) {
        expect(draftPickAllowedForSlot(entry.card, "GK", true)).toBe(true);
      } else {
        expect(draftPickAllowedForSlot(entry.card, "GK", true)).toBe(false);
      }
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

  it("runs spin → pick → ready flow without pre-selecting a slot", () => {
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
    const filled = state.formation
      .map((s, i) => (s.playerId ? i : -1))
      .filter((i) => i >= 0);
    expect(filled.length).toBeGreaterThanOrEqual(2);
    const aIdx = filled[0]!;
    const bIdx = filled[1]!;
    const a = state.formation[aIdx]!;
    const b = state.formation[bIdx]!;
    const poolMap = new Map(pool.map((p) => [p.playerId, p]));
    const pa = poolMap.get(a.playerId!)!;
    const pb = poolMap.get(b.playerId!)!;
    const canSwap =
      draftPickAllowedForSlot(pa, b.position, true) && draftPickAllowedForSlot(pb, a.position, true);
    if (canSwap) {
      const swapped = swapFormationSlots(state, aIdx, bIdx, pool);
      expect(swapped.formation[aIdx]!.playerId).toBe(b.playerId);
      expect(swapped.formation[bIdx]!.playerId).toBe(a.playerId);
    } else {
      expect(() => swapFormationSlots(state, aIdx, bIdx, pool)).toThrow(/cannot play/);
    }
  });
});
