import type { DraftPick, DraftRoomState } from "@sportverse/draftballer-types";
import { applyPickFSM, validatePickFSM, type DraftRoomFSM } from "./draft-room-fsm.js";
import { activeDrafter } from "./draft-room.js";
import {
  clearResolvedLot,
  openAuctionLot,
  placeAuctionBid,
  resolveAuctionLot,
} from "./draft-auction.js";
import {
  blindRoundReady,
  resolveBlindRound,
  startNextBlindRound,
  submitBlindPick,
} from "./draft-blind.js";
import type { RatedPlayerCard } from "@sportverse/draftballer-types";

/** Shared pick validation for client + server (bible §6). */
export function serverApplyPick(
  fsm: DraftRoomFSM,
  playerId: string,
  drafterIndex: number,
  playerName: string,
  ovr: number,
): { fsm: DraftRoomFSM; error?: string } {
  const err = validatePickFSM(fsm, playerId, drafterIndex);
  if (err) return { fsm, error: err };

  const round = Math.floor(fsm.state.currentPickIndex / fsm.state.drafterCount) + 1;
  const pick: DraftPick = {
    round,
    pickInRound: (fsm.state.currentPickIndex % fsm.state.drafterCount) + 1,
    drafterIndex,
    playerId,
    playerName,
    ovr,
  };
  return { fsm: applyPickFSM(fsm, pick) };
}

export function drafterIndexForPick(state: DraftRoomState): number {
  return activeDrafter(state);
}

export function serverNominateAuction(
  fsm: DraftRoomFSM,
  player: RatedPlayerCard,
  nominatorIndex: number,
): { fsm: DraftRoomFSM; error?: string } {
  try {
    const state = openAuctionLot(fsm.state, player, nominatorIndex);
    return { fsm: { ...fsm, state } };
  } catch (e) {
    return { fsm, error: String(e) };
  }
}

export function serverAuctionBid(
  fsm: DraftRoomFSM,
  drafterIndex: number,
  amount: number,
): { fsm: DraftRoomFSM; error?: string } {
  const { room, error } = placeAuctionBid(fsm.state, drafterIndex, amount);
  if (error) return { fsm, error };
  return { fsm: { ...fsm, state: room } };
}

export function serverResolveAuction(fsm: DraftRoomFSM): { fsm: DraftRoomFSM; error?: string } {
  const { room, error } = resolveAuctionLot(fsm.state);
  if (error) return { fsm, error };
  const cleared = clearResolvedLot(room);
  const complete = cleared.status === "complete";
  return {
    fsm: {
      ...fsm,
      phase: complete ? "COMPLETE" : fsm.phase,
      state: cleared,
    },
  };
}

export function serverBlindPick(
  fsm: DraftRoomFSM,
  drafterIndex: number,
  player: RatedPlayerCard,
): { fsm: DraftRoomFSM; error?: string; ready?: boolean } {
  const { room, error } = submitBlindPick(fsm.state, drafterIndex, player);
  if (error) return { fsm, error };
  const nextFsm = { ...fsm, state: room };
  return { fsm: nextFsm, ready: blindRoundReady(room) };
}

export function serverResolveBlind(fsm: DraftRoomFSM): { fsm: DraftRoomFSM; error?: string } {
  const { room, error } = resolveBlindRound(fsm.state);
  if (error) return { fsm, error };
  let next = room.status === "complete" ? room : startNextBlindRound(room);
  const complete = next.status === "complete";
  return {
    fsm: {
      ...fsm,
      phase: complete ? "COMPLETE" : fsm.phase,
      state: next,
    },
  };
}
