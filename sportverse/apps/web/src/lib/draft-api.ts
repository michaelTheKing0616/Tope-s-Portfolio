import type { DraftFormat, DraftRoomFSM } from "@sportverse/draftballer-types";
import { resolveApiBase } from "@sportverse/platform";

const API_BASE = resolveApiBase();

export function isDraftApiEnabled(): boolean {
  return API_BASE.length > 0;
}

export function draftApiBase(): string {
  return API_BASE;
}

async function draftFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE) throw new Error("VITE_API_URL not configured");
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string };
    throw new Error(err.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export async function createDraftRoom(body: {
  modeId: string;
  drafters?: number;
  squadSize?: number;
  format?: DraftFormat;
}): Promise<{ code: string; poolCount: number; format: DraftFormat }> {
  return draftFetch("/api/draft/rooms", { method: "POST", body: JSON.stringify(body) });
}

export async function fetchDraftRoom(code: string): Promise<DraftRoomFSM> {
  return draftFetch(`/api/draft/rooms/${encodeURIComponent(code)}`);
}

export async function startDraftRoom(code: string): Promise<DraftRoomFSM> {
  return draftFetch(`/api/draft/rooms/${encodeURIComponent(code)}/start`, { method: "POST" });
}

export async function pickInDraftRoom(
  code: string,
  body: { playerId: string; playerName: string; ovr: number; drafterIndex: number },
): Promise<DraftRoomFSM> {
  return draftFetch(`/api/draft/rooms/${encodeURIComponent(code)}/pick`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function nominateAuction(
  code: string,
  body: { playerId: string; nominatorIndex: number },
): Promise<DraftRoomFSM> {
  return draftFetch(`/api/draft/rooms/${encodeURIComponent(code)}/auction/nominate`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function bidAuction(
  code: string,
  body: { drafterIndex: number; amount: number },
): Promise<DraftRoomFSM> {
  return draftFetch(`/api/draft/rooms/${encodeURIComponent(code)}/auction/bid`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function resolveAuction(code: string): Promise<DraftRoomFSM> {
  return draftFetch(`/api/draft/rooms/${encodeURIComponent(code)}/auction/resolve`, { method: "POST" });
}

export async function blindPick(
  code: string,
  body: { playerId: string; drafterIndex: number },
): Promise<DraftRoomFSM & { blindRoundReady?: boolean }> {
  return draftFetch(`/api/draft/rooms/${encodeURIComponent(code)}/blind/pick`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function resolveBlindRound(code: string): Promise<DraftRoomFSM> {
  return draftFetch(`/api/draft/rooms/${encodeURIComponent(code)}/blind/resolve`, { method: "POST" });
}
