import type { DraftFormat, DraftPick, DraftRoomState, RatedPlayerCard } from "@sportverse/draftballer-types";
import type { DraftModeConfig } from "@sportverse/draftballer-types";

export function createDraftRoom(
  mode: DraftModeConfig,
  pool: RatedPlayerCard[],
  drafterCount = 2,
  squadSize = 11,
  format: DraftFormat = "snake",
): DraftRoomState {
  return {
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
): DraftRoomState {
  const drafter = drafterIndex ?? activeDrafter(room);
  if (room.status !== "picking") throw new Error("Draft complete");
  if (!room.poolIds.includes(playerId)) throw new Error("Player not in pool");
  if (room.rosters[drafter]!.length >= room.squadSize) throw new Error("Squad full");

  const card = pool.get(playerId);
  if (!card) throw new Error("Unknown player");

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

export function squadRating(roster: string[], pool: Map<string, RatedPlayerCard>): number {
  if (!roster.length) return 0;
  const ovrs = roster.map((id) => pool.get(id)?.ovr ?? 0);
  return Math.round(ovrs.reduce((a, b) => a + b, 0) / ovrs.length);
}
