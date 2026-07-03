import { describe, expect, it } from "vitest";
import type { DraftModeConfig } from "@sportverse/draftballer-types";
import {
  advanceToPoolReady,
  applyPickFSM,
  createRoomFSM,
  startPicking,
  validatePickFSM,
} from "./draft-room-fsm.js";
import { createDraftRoom } from "./draft-room.js";

const mode: DraftModeConfig = {
  id: "test",
  title: "Test",
  blurb: "",
  era: "all_time",
  competitionScope: "any_league",
  ratingLens: "club_only",
  blendFactor: 0,
};

describe("draft-room FSM", () => {
  it("transitions LOBBY → POOL_READY → PICKING → COMPLETE", () => {
    const room = createDraftRoom(mode, [], 2, 1);
    room.status = "lobby";
    let fsm = createRoomFSM(room);
    expect(fsm.phase).toBe("LOBBY");

    fsm = advanceToPoolReady(fsm);
    expect(fsm.phase).toBe("POOL_READY");

    fsm = startPicking(fsm);
    expect(fsm.phase).toBe("PICKING");

    fsm.state.poolIds = ["a", "b"];
    const err = validatePickFSM(fsm, "a", 0);
    expect(err).toBeNull();

    fsm = applyPickFSM(fsm, {
      round: 1,
      pickInRound: 1,
      drafterIndex: 0,
      playerId: "a",
      playerName: "A",
      ovr: 80,
    });
    expect(fsm.state.picks).toHaveLength(1);

    fsm = applyPickFSM(fsm, {
      round: 1,
      pickInRound: 2,
      drafterIndex: 1,
      playerId: "b",
      playerName: "B",
      ovr: 78,
    });
    expect(fsm.phase).toBe("COMPLETE");
  });
});
