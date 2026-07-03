import type { DraftPick, DraftRoomState } from "@sportverse/draftballer-types";
import { initBlindRound } from "./draft-blind.js";
import { initialAuctionBudgets } from "./draft-auction.js";

export type RoomPhase = "LOBBY" | "POOL_READY" | "PICKING" | "COMPLETE";

export interface DraftRoomFSM {
  phase: RoomPhase;
  state: DraftRoomState;
}

export function createRoomFSM(state: DraftRoomState): DraftRoomFSM {
  return { phase: state.status === "picking" ? "PICKING" : "LOBBY", state };
}

export function advanceToPoolReady(fsm: DraftRoomFSM): DraftRoomFSM {
  if (fsm.phase !== "LOBBY") throw new Error("Invalid transition");
  return { ...fsm, phase: "POOL_READY", state: { ...fsm.state, status: "lobby" } };
}

export function startPicking(fsm: DraftRoomFSM): DraftRoomFSM {
  if (fsm.phase !== "POOL_READY" && fsm.phase !== "LOBBY") throw new Error("Invalid transition");
  let state: DraftRoomState = { ...fsm.state, status: "picking" };
  if (state.format === "auction" && !state.budgets) {
    state = { ...state, budgets: initialAuctionBudgets(state.drafterCount, state.squadSize), auctionLot: null };
  }
  if (state.format === "blind" && !state.blindRound) {
    state = initBlindRound(state);
  }
  return { ...fsm, phase: "PICKING", state };
}

export function applyPickFSM(fsm: DraftRoomFSM, pick: DraftPick): DraftRoomFSM {
  if (fsm.phase !== "PICKING") throw new Error("Room not picking");
  const picks = [...fsm.state.picks, pick];
  const rosters = fsm.state.rosters.map((r, i) =>
    i === pick.drafterIndex ? [...r, pick.playerId] : r,
  );
  const poolIds = fsm.state.poolIds.filter((id) => id !== pick.playerId);
  const nextPick = picks.length;
  const complete = nextPick >= fsm.state.drafterCount * fsm.state.squadSize;
  return {
    phase: complete ? "COMPLETE" : "PICKING",
    state: {
      ...fsm.state,
      picks,
      rosters,
      poolIds,
      currentPickIndex: nextPick,
      status: complete ? "complete" : "picking",
    },
  };
}

export function validatePickFSM(fsm: DraftRoomFSM, playerId: string, drafterIndex: number): string | null {
  if (fsm.state.format === "auction") return "Use auction bid flow";
  if (fsm.state.format === "blind") return "Use blind pick flow";
  if (fsm.phase !== "PICKING") return "Room not accepting picks";
  const expected = fsm.state.currentPickIndex % fsm.state.drafterCount;
  if (fsm.state.format === "snake") {
    const round = Math.floor(fsm.state.currentPickIndex / fsm.state.drafterCount);
    const pos = fsm.state.currentPickIndex % fsm.state.drafterCount;
    const expectedSnake = round % 2 === 1 ? fsm.state.drafterCount - 1 - pos : pos;
    if (drafterIndex !== expectedSnake) return "Not your turn";
  } else if (drafterIndex !== expected) {
    return "Not your turn";
  }
  if (!fsm.state.poolIds.includes(playerId)) return "Player not in pool";
  if (fsm.state.picks.some((p) => p.playerId === playerId)) return "Player already drafted";
  return null;
}
