import { io, type Socket } from "socket.io-client";
import type { DraftFormat, DraftRoomFSM } from "@sportverse/draftballer-types";
import { draftApiBase, isDraftApiEnabled } from "./draft-api.js";

export type DraftSocket = Socket;

export function connectDraftSocket(): DraftSocket | null {
  if (!isDraftApiEnabled()) return null;
  return io(draftApiBase(), { path: "/ws/draft", transports: ["websocket", "polling"] });
}

export function socketCreateRoom(
  socket: DraftSocket,
  payload: { modeId: string; drafters?: number; squadSize?: number; format?: DraftFormat },
): Promise<{ ok: boolean; code?: string; fsm?: DraftRoomFSM; error?: string }> {
  return new Promise((resolve) => {
    socket.emit("create_room", payload, (ack: { ok: boolean; code?: string; fsm?: DraftRoomFSM; error?: string }) => {
      resolve(ack ?? { ok: false, error: "No response" });
    });
  });
}

export function socketJoinRoom(
  socket: DraftSocket,
  code: string,
): Promise<{ ok: boolean; drafterIndex?: number; fsm?: DraftRoomFSM; error?: string }> {
  return new Promise((resolve) => {
    socket.emit("join_room", { code }, (ack: { ok: boolean; drafterIndex?: number; fsm?: DraftRoomFSM; error?: string }) => {
      resolve(ack ?? { ok: false, error: "No response" });
    });
  });
}

export function socketStartDraft(socket: DraftSocket): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    socket.emit("start_draft", {}, (ack: { ok: boolean; error?: string }) => {
      resolve(ack ?? { ok: false, error: "No response" });
    });
  });
}

export function socketPick(
  socket: DraftSocket,
  payload: { playerId: string; playerName: string; ovr: number },
): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    socket.emit("pick_request", payload, (ack: { ok: boolean; error?: string }) => {
      resolve(ack ?? { ok: false, error: "No response" });
    });
  });
}

export function socketNominate(
  socket: DraftSocket,
  payload: { playerId: string; nominatorIndex: number },
): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    socket.emit("auction_nominate", payload, (ack: { ok: boolean; error?: string }) => {
      resolve(ack ?? { ok: false, error: "No response" });
    });
  });
}

export function socketBid(
  socket: DraftSocket,
  payload: { drafterIndex: number; amount: number },
): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    socket.emit("auction_bid", payload, (ack: { ok: boolean; error?: string }) => {
      resolve(ack ?? { ok: false, error: "No response" });
    });
  });
}

export function socketResolveAuction(socket: DraftSocket): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    socket.emit("auction_resolve", {}, (ack: { ok: boolean; error?: string }) => {
      resolve(ack ?? { ok: false, error: "No response" });
    });
  });
}

export function socketBlindPick(
  socket: DraftSocket,
  payload: { playerId: string; drafterIndex: number },
): Promise<{ ok: boolean; error?: string; ready?: boolean }> {
  return new Promise((resolve) => {
    socket.emit("blind_pick", payload, (ack: { ok: boolean; error?: string; ready?: boolean }) => {
      resolve(ack ?? { ok: false, error: "No response" });
    });
  });
}

export function socketResolveBlind(socket: DraftSocket): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    socket.emit("blind_resolve", {}, (ack: { ok: boolean; error?: string }) => {
      resolve(ack ?? { ok: false, error: "No response" });
    });
  });
}
