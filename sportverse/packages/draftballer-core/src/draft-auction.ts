import type { AuctionLotState, DraftPick, DraftRoomState, RatedPlayerCard } from "@sportverse/draftballer-types";
import { activeDrafter } from "./draft-room.js";

export const AUCTION_BUDGET_PER_SLOT = 100;

export function initialAuctionBudgets(drafterCount: number, squadSize: number): number[] {
  const budget = squadSize * AUCTION_BUDGET_PER_SLOT;
  return Array.from({ length: drafterCount }, () => budget);
}

export function rosterSlotsRemaining(room: DraftRoomState, drafterIndex: number): number {
  return room.squadSize - room.rosters[drafterIndex]!.length;
}

export function minReserveForRemainingSlots(room: DraftRoomState, drafterIndex: number): number {
  const remaining = rosterSlotsRemaining(room, drafterIndex) - 1;
  return Math.max(0, remaining);
}

export function maxAffordableBid(room: DraftRoomState, drafterIndex: number): number {
  const budget = room.budgets?.[drafterIndex] ?? 0;
  return Math.max(0, budget - minReserveForRemainingSlots(room, drafterIndex));
}

export function nominatorIndex(room: DraftRoomState): number {
  return activeDrafter(room);
}

export function openAuctionLot(
  room: DraftRoomState,
  player: RatedPlayerCard,
  nominatorIndex: number,
): DraftRoomState {
  if (room.format !== "auction") throw new Error("Not an auction room");
  if (room.status !== "picking") throw new Error("Draft complete");
  if (room.auctionLot?.status === "open") throw new Error("Lot already open");
  if (!room.poolIds.includes(player.playerId)) throw new Error("Player not in pool");

  const lot: AuctionLotState = {
    playerId: player.playerId,
    playerName: player.name,
    ovr: player.ovr,
    nominatorIndex,
    highBid: 1,
    highBidder: null,
    status: "open",
  };

  return { ...room, auctionLot: lot };
}

export function validateAuctionBid(
  room: DraftRoomState,
  drafterIndex: number,
  amount: number,
): string | null {
  if (room.format !== "auction") return "Not an auction room";
  if (room.status !== "picking") return "Draft complete";
  const lot = room.auctionLot;
  if (!lot || lot.status !== "open") return "No open lot";

  if (rosterSlotsRemaining(room, drafterIndex) <= 0) return "Squad full";
  if (amount < lot.highBid + (lot.highBidder === null ? 0 : 1)) {
    return lot.highBidder === null ? "Bid must be at least 1" : `Bid must exceed ${lot.highBid}`;
  }
  if (amount > maxAffordableBid(room, drafterIndex)) return "Insufficient budget";

  return null;
}

export function placeAuctionBid(
  room: DraftRoomState,
  drafterIndex: number,
  amount: number,
): { room: DraftRoomState; error?: string } {
  const err = validateAuctionBid(room, drafterIndex, amount);
  if (err) return { room, error: err };

  const lot = room.auctionLot!;
  return {
    room: {
      ...room,
      auctionLot: { ...lot, highBid: amount, highBidder: drafterIndex },
    },
  };
}

export function resolveAuctionLot(room: DraftRoomState): { room: DraftRoomState; error?: string } {
  if (room.format !== "auction") return { room, error: "Not an auction room" };
  const lot = room.auctionLot;
  if (!lot || lot.status !== "open") return { room, error: "No open lot" };

  const winner = lot.highBidder ?? lot.nominatorIndex;
  const amount = lot.highBidder === null ? 1 : lot.highBid;

  if (amount > maxAffordableBid(room, winner)) {
    return { room, error: "Winning bid exceeds budget" };
  }

  const round = Math.floor(room.currentPickIndex / room.drafterCount) + 1;
  const pick: DraftPick = {
    round,
    pickInRound: (room.currentPickIndex % room.drafterCount) + 1,
    drafterIndex: winner,
    playerId: lot.playerId,
    playerName: lot.playerName,
    ovr: lot.ovr,
  };

  const budgets = [...(room.budgets ?? initialAuctionBudgets(room.drafterCount, room.squadSize))];
  budgets[winner] = (budgets[winner] ?? 0) - amount;

  const rosters = room.rosters.map((r, i) => (i === winner ? [...r, lot.playerId] : r));
  const poolIds = room.poolIds.filter((id) => id !== lot.playerId);
  const nextIndex = room.currentPickIndex + 1;
  const totalPicks = room.drafterCount * room.squadSize;
  const complete = nextIndex >= totalPicks || poolIds.length === 0;

  return {
    room: {
      ...room,
      picks: [...room.picks, pick],
      rosters,
      poolIds,
      budgets,
      currentPickIndex: nextIndex,
      status: complete ? "complete" : "picking",
      auctionLot: { ...lot, status: "resolved" },
    },
  };
}

export function clearResolvedLot(room: DraftRoomState): DraftRoomState {
  if (room.auctionLot?.status !== "resolved") return room;
  return { ...room, auctionLot: null };
}

/** Bot nominates highest OVR affordable target from pool. */
export function botNominatePlayer(room: DraftRoomState, pool: Map<string, RatedPlayerCard>): RatedPlayerCard | null {
  const idx = nominatorIndex(room);
  const candidates = room.poolIds
    .map((id) => pool.get(id))
    .filter(Boolean)
    .sort((a, b) => b!.ovr - a!.ovr) as RatedPlayerCard[];
  return candidates[0] ?? null;
}

/** Bot bids up to fair value based on OVR and remaining budget. */
export function botAuctionBid(room: DraftRoomState, drafterIndex: number): number | null {
  const lot = room.auctionLot;
  if (!lot || lot.status !== "open") return null;
  if (drafterIndex === lot.nominatorIndex && lot.highBidder !== null) return null;

  const fair = Math.min(lot.ovr, maxAffordableBid(room, drafterIndex));
  const minBid = lot.highBidder === null ? 1 : lot.highBid + 1;
  if (fair < minBid) return null;

  const aggression = 0.85 + (drafterIndex % 3) * 0.05;
  const bid = Math.min(fair, Math.max(minBid, Math.round(lot.ovr * aggression)));
  if (validateAuctionBid(room, drafterIndex, bid)) return null;
  return bid;
}
