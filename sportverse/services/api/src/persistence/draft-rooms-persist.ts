import type { DraftRoomFSM } from "@sportverse/draftballer-core";
import { FileStore, resolveDataPath } from "./file-store.js";

type RoomStore = Record<string, { fsm: DraftRoomFSM; expires: number }>;

const store = new FileStore<RoomStore>(resolveDataPath("draft-rooms.json"));

export function loadPersistedRooms(): RoomStore {
  const data = store.read();
  const now = Date.now();
  const out: RoomStore = {};
  for (const [code, room] of Object.entries(data)) {
    if (room.expires >= now) out[code] = room;
  }
  return out;
}

export function persistRoom(code: string, fsm: DraftRoomFSM, expires: number): void {
  store.update((current) => ({ ...current, [code]: { fsm, expires } }));
}

export function deletePersistedRoom(code: string): void {
  store.update((current) => {
    const next = { ...current };
    delete next[code];
    return next;
  });
}
