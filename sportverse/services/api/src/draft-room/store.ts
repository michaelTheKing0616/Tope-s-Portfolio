import type { DraftFormat, DraftModeConfig, DraftRoomState } from "@sportverse/draftballer-types";
import { createRoomFSM, initialAuctionBudgets, type DraftRoomFSM } from "@sportverse/draftballer-core";
import { loadPersistedRooms } from "../persistence/draft-rooms-persist.js";

const TTL_MS = 2 * 60 * 60 * 1000;
const rooms = new Map<string, { fsm: DraftRoomFSM; expires: number }>();

function purge() {
  const now = Date.now();
  for (const [id, room] of rooms) {
    if (room.expires < now) rooms.delete(id);
  }
}

function hydratePersistedRooms(): void {
  try {
    const persisted = loadPersistedRooms();
    for (const [code, room] of Object.entries(persisted)) {
      if (!rooms.has(code)) rooms.set(code, room);
    }
  } catch {
    /* optional persistence */
  }
}

hydratePersistedRooms();

export function createRoom(
  code: string,
  mode: DraftModeConfig,
  poolIds: string[],
  drafterCount: number,
  squadSize: number,
  format: DraftFormat = "snake",
): DraftRoomFSM {
  purge();
  let state: DraftRoomState = {
    id: code,
    mode,
    format,
    drafterCount,
    squadSize,
    currentPickIndex: 0,
    picks: [],
    rosters: Array.from({ length: drafterCount }, () => []),
    poolIds: [...poolIds],
    status: "lobby",
  };

  if (format === "auction") {
    state = { ...state, budgets: initialAuctionBudgets(drafterCount, squadSize), auctionLot: null };
  }

  const fsm = createRoomFSM(state);
  rooms.set(code, { fsm, expires: Date.now() + TTL_MS });
  return fsm;
}

export function getRoom(code: string): DraftRoomFSM | null {
  purge();
  return rooms.get(code)?.fsm ?? null;
}

export function saveRoom(code: string, fsm: DraftRoomFSM): void {
  rooms.set(code, { fsm, expires: Date.now() + TTL_MS });
}

export function roomCount(): number {
  purge();
  return rooms.size;
}

export function reloadPersistedRooms(): void {
  hydratePersistedRooms();
}
