import type { DraftFormat, DraftModeConfig, DraftPick, DraftRoomState, Position, RatedPlayerCard } from "@sportverse/draftballer-types";
import { computeSquadRating } from "@sportverse/rating-engine";
import { initialAuctionBudgets } from "./draft-auction.js";
import { initBlindRound } from "./draft-blind.js";
import { draftPickAllowedForSlot } from "./squad-rules.js";

export type DraftPickError = { error: "position_full" | "player_not_in_pool" | "squad_full" | "draft_complete" };

const DEFAULT_FORMATION: Position[] = ["GK", "CB", "CB", "FB", "FB", "CM", "CM", "AM", "W", "W", "ST"];

export function formationSlots(squadSize = 11): { id: string; position: Position }[] {
  const positions = DEFAULT_FORMATION.slice(0, squadSize);
  while (positions.length < squadSize) positions.push("CM");
  return positions.map((position, i) => ({ id: `slot_${i}`, position, playerId: undefined }));
}

export function openFormationSlots(roster: string[], pool: Map<string, RatedPlayerCard>, squadSize = 11): Position[] {
  const slots = formationSlots(squadSize);
  const filled = roster.map((id) => pool.get(id)).filter(Boolean) as RatedPlayerCard[];
  const posCounts: Partial<Record<Position, number>> = {};
  for (const p of filled) posCounts[p.position] = (posCounts[p.position] ?? 0) + 1;

  const needed: Position[] = [];
  for (const slot of slots) {
    const have = posCounts[slot.position] ?? 0;
    const required = slots.filter((s) => s.position === slot.position).length;
    if (have < required) {
      needed.push(slot.position);
      posCounts[slot.position] = have + 1;
    }
  }
  return needed;
}

export function createDraftRoom(
  mode: DraftModeConfig,
  pool: RatedPlayerCard[],
  drafterCount = 2,
  squadSize = 11,
  format: DraftFormat = "snake",
): DraftRoomState {
  let room: DraftRoomState = {
    id: `room_${Date.now()}`,
    mode,
    format,
    drafterCount,
    squadSize,
    currentPickIndex: 0,
    picks: [],
    rosters: Array.from({ length: drafterCount }, () => []),
    poolIds: pool.map((p) => p.playerId),
    status: "picking",
  };

  if (format === "auction") {
    room = { ...room, budgets: initialAuctionBudgets(drafterCount, squadSize), auctionLot: null };
  }
  if (format === "blind") {
    room = initBlindRound(room);
  }

  return room;
}

export function pickOrderForIndex(pickIndex: number, drafterCount: number, format: DraftFormat): number {
  const round = Math.floor(pickIndex / drafterCount);
  const posInRound = pickIndex % drafterCount;
  if (format === "linear") return posInRound;
  return round % 2 === 0 ? posInRound : drafterCount - 1 - posInRound;
}

export function activeDrafter(room: DraftRoomState): number {
  return pickOrderForIndex(room.currentPickIndex, room.drafterCount, room.format);
}

export function makePick(
  room: DraftRoomState,
  playerId: string,
  pool: Map<string, RatedPlayerCard>,
  drafterIndex?: number,
): DraftRoomState | DraftPickError {
  const drafter = drafterIndex ?? activeDrafter(room);
  if (room.status !== "picking") return { error: "draft_complete" };
  if (!room.poolIds.includes(playerId)) return { error: "player_not_in_pool" };
  if (room.rosters[drafter]!.length >= room.squadSize) return { error: "squad_full" };

  const card = pool.get(playerId);
  if (!card) throw new Error("Unknown player");

  if (room.mode.positionLocked !== false) {
    const open = openFormationSlots(room.rosters[drafter]!, pool, room.squadSize);
    if (open.length && !open.some((pos) => draftPickAllowedForSlot(card, pos, true))) {
      return { error: "position_full" };
    }
  }

  const round = Math.floor(room.currentPickIndex / room.drafterCount) + 1;
  const pick: DraftPick = {
    round,
    pickInRound: (room.currentPickIndex % room.drafterCount) + 1,
    drafterIndex: drafter,
    playerId,
    playerName: card.name,
    ovr: card.ovr,
  };

  const rosters = room.rosters.map((r, i) => (i === drafter ? [...r, playerId] : [...r]));
  const poolIds = room.poolIds.filter((id) => id !== playerId);
  const nextIndex = room.currentPickIndex + 1;
  const totalPicks = room.drafterCount * room.squadSize;
  const complete = nextIndex >= totalPicks || poolIds.length === 0;

  return {
    ...room,
    picks: [...room.picks, pick],
    rosters,
    poolIds,
    currentPickIndex: nextIndex,
    status: complete ? "complete" : "picking",
  };
}

export function squadRating(roster: string[], pool: Map<string, RatedPlayerCard>, formationId?: string): number {
  if (!roster.length) return 0;
  const players = roster.map((id) => pool.get(id)).filter(Boolean) as RatedPlayerCard[];
  return computeSquadRating(players, { formationId }).squadRating;
}
