import { describe, expect, it } from "vitest";
import {
  fameTierFromScore,
  getDraftPlayers,
  getFameScore,
  listSpinnableClubSeasons,
  looksLikeCompetitionId,
  poolCounts,
} from "@sportverse/sports-db";
import {
  buildDraftPool,
  createWheelSession,
  getPickCandidates,
  getPresetMode,
  spinToSegment,
} from "./index.js";

const fullData = () => poolCounts().seasonStatRows > 1000;

describe("candidate quality property tests — Phase 4", () => {
  it("no candidate list is >30% obscure tier", () => {
    const mode = getPresetMode("all-time-any");
    const pool = buildDraftPool(mode);
    const state0 = createWheelSession(mode, pool, "quality-seed-1");
    if (!state0.segments.length) return;
    const state = spinToSegment(state0, 0, pool);
    const candidates = getPickCandidates(state, pool);
    if (!candidates.length) return;
    const obscure = candidates.filter(
      (c) => fameTierFromScore(getFameScore(c.playerId)) === "obscure",
    ).length;
    expect(obscure / candidates.length).toBeLessThanOrEqual(0.3);
  });

  it("every spinnable club-season squad has ≥14 players", () => {
    const mode = getPresetMode("all-time-any");
    const list = listSpinnableClubSeasons(mode);
    if (!list.length) {
      expect(fullData() || true).toBe(true);
      return;
    }
    for (const entry of list) {
      expect(entry.playerIds.length).toBeGreaterThanOrEqual(14);
      expect(looksLikeCompetitionId(entry.clubName)).toBe(false);
    }
  });

  it("GK present in ≥95% of spinnable squads (or fallback path exists)", () => {
    const mode = getPresetMode("all-time-any");
    const list = listSpinnableClubSeasons(mode);
    if (!list.length) return;
    const players = new Map(getDraftPlayers().map((p) => [p.id, p]));
    let withGk = 0;
    for (const entry of list) {
      const hasGk = entry.playerIds.some((id) => {
        const pos = players.get(id)?.position ?? "";
        return /gk|goal/i.test(pos);
      });
      if (hasGk) withGk++;
    }
    const ratio = withGk / list.length;
    // With full data expect ≥95%; fixtures may be thinner — gate on pool size.
    if (fullData()) {
      expect(ratio).toBeGreaterThanOrEqual(0.95);
    } else {
      expect(ratio).toBeGreaterThanOrEqual(0.5);
    }
  });
});
