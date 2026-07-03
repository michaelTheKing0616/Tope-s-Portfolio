import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import type { DraftFormat, DraftModeConfig, RatedPlayerCard } from "@sportverse/draftballer-types";
import {
  buildDraftPool,
  getPresetMode,
  serverApplyPick,
  serverAuctionBid,
  serverBlindPick,
  serverNominateAuction,
  serverResolveAuction,
  serverResolveBlind,
  startPicking,
  advanceToPoolReady,
} from "@sportverse/draftballer-core";
import { createRoom, getRoom, saveRoom } from "./draft-room/store.js";
import { persistRoom } from "./persistence/draft-rooms-persist.js";

const PICK_TIMER_MS = 45_000;
const TTL_MS = 2 * 60 * 60 * 1000;

function roomCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function persist(code: string, fsm: NonNullable<ReturnType<typeof getRoom>>): void {
  saveRoom(code, fsm);
  persistRoom(code, fsm, Date.now() + TTL_MS);
}

function cardFromPool(pool: RatedPlayerCard[], playerId: string): RatedPlayerCard | undefined {
  return pool.find((p) => p.playerId === playerId);
}

export function attachDraftSocket(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: "*" },
    path: "/ws/draft",
  });

  io.on("connection", (socket) => {
    let joinedCode: string | null = null;
    let drafterIndex: number | null = null;
    let poolCards: RatedPlayerCard[] = [];

    socket.on(
      "create_room",
      (
        payload: {
          modeId?: string;
          drafters?: number;
          squadSize?: number;
          format?: DraftFormat;
        },
        ack,
      ) => {
        const mode = getPresetMode(payload.modeId ?? "all-time-any");
        poolCards = buildDraftPool(mode);
        const code = roomCode();
        const fsm = createRoom(
          code,
          mode,
          poolCards.map((p) => p.playerId),
          payload.drafters ?? 2,
          payload.squadSize ?? 11,
          payload.format ?? "snake",
        );
        joinedCode = code;
        drafterIndex = 0;
        socket.join(code);
        ack?.({ ok: true, code, fsm, format: payload.format ?? "snake" });
        io.to(code).emit("room_state", fsm);
      },
    );

    socket.on("join_room", (payload: { code: string; spectator?: boolean }, ack) => {
      const fsm = getRoom(payload.code.toUpperCase());
      if (!fsm) {
        ack?.({ ok: false, error: "Room not found" });
        return;
      }
      poolCards = buildDraftPool(fsm.state.mode);
      joinedCode = payload.code.toUpperCase();
      if (payload.spectator) {
        drafterIndex = null;
      } else {
        drafterIndex = Math.min(fsm.state.rosters.length - 1, fsm.state.picks.length % fsm.state.drafterCount);
      }
      socket.join(joinedCode);
      ack?.({ ok: true, drafterIndex, spectator: payload.spectator ?? false, fsm });
      io.to(joinedCode).emit("room_state", fsm);
    });

    socket.on("start_draft", (_payload: unknown, ack?: (r: { ok: boolean; error?: string }) => void) => {
      if (!joinedCode) return;
      let fsm = getRoom(joinedCode);
      if (!fsm) return;
      try {
        fsm = advanceToPoolReady(fsm);
        fsm = startPicking(fsm);
        persist(joinedCode, fsm);
        io.to(joinedCode).emit("room_state", fsm);
        ack?.({ ok: true });
      } catch (e) {
        ack?.({ ok: false, error: String(e) });
      }
    });

    socket.on(
      "pick_request",
      (
        payload: { playerId: string; playerName: string; ovr: number },
        ack?: (r: { ok: boolean; error?: string }) => void,
      ) => {
        if (!joinedCode || drafterIndex === null) return;
        const fsm = getRoom(joinedCode);
        if (!fsm) return;
        const { fsm: next, error } = serverApplyPick(
          fsm,
          payload.playerId,
          drafterIndex,
          payload.playerName,
          payload.ovr,
        );
        if (error) {
          socket.emit("pick_rejected", { error });
          ack?.({ ok: false, error });
          return;
        }
        persist(joinedCode, next);
        io.to(joinedCode).emit("pick_confirmed", next.state.picks[next.state.picks.length - 1]);
        io.to(joinedCode).emit("room_state", next);
        if (next.phase === "COMPLETE") io.to(joinedCode).emit("room_complete", next.state);
        ack?.({ ok: true });
      },
    );

    socket.on(
      "auction_nominate",
      (payload: { playerId: string; nominatorIndex: number }, ack?: (r: { ok: boolean; error?: string }) => void) => {
        if (!joinedCode) return;
        const fsm = getRoom(joinedCode);
        if (!fsm) return;
        const card = cardFromPool(poolCards, payload.playerId);
        if (!card) {
          ack?.({ ok: false, error: "Unknown player" });
          return;
        }
        const { fsm: next, error } = serverNominateAuction(fsm, card, payload.nominatorIndex);
        if (error) {
          ack?.({ ok: false, error });
          return;
        }
        persist(joinedCode, next);
        io.to(joinedCode).emit("room_state", next);
        ack?.({ ok: true });
      },
    );

    socket.on(
      "auction_bid",
      (payload: { drafterIndex: number; amount: number }, ack?: (r: { ok: boolean; error?: string }) => void) => {
        if (!joinedCode) return;
        const fsm = getRoom(joinedCode);
        if (!fsm) return;
        const { fsm: next, error } = serverAuctionBid(fsm, payload.drafterIndex, payload.amount);
        if (error) {
          ack?.({ ok: false, error });
          return;
        }
        persist(joinedCode, next);
        io.to(joinedCode).emit("auction_bid", { drafterIndex: payload.drafterIndex, amount: payload.amount });
        io.to(joinedCode).emit("room_state", next);
        ack?.({ ok: true });
      },
    );

    socket.on("auction_resolve", (_payload: unknown, ack?: (r: { ok: boolean; error?: string }) => void) => {
      if (!joinedCode) return;
      const fsm = getRoom(joinedCode);
      if (!fsm) return;
      const { fsm: next, error } = serverResolveAuction(fsm);
      if (error) {
        ack?.({ ok: false, error });
        return;
      }
      persist(joinedCode, next);
      io.to(joinedCode).emit("room_state", next);
      if (next.phase === "COMPLETE") io.to(joinedCode).emit("room_complete", next.state);
      ack?.({ ok: true });
    });

    socket.on(
      "blind_pick",
      (payload: { playerId: string; drafterIndex: number }, ack?: (r: { ok: boolean; error?: string; ready?: boolean }) => void) => {
        if (!joinedCode) return;
        const fsm = getRoom(joinedCode);
        if (!fsm) return;
        const card = cardFromPool(poolCards, payload.playerId);
        if (!card) {
          ack?.({ ok: false, error: "Unknown player" });
          return;
        }
        const { fsm: next, error, ready } = serverBlindPick(fsm, payload.drafterIndex, card);
        if (error) {
          ack?.({ ok: false, error });
          return;
        }
        persist(joinedCode, next);
        io.to(joinedCode).emit("room_state", next);
        if (ready) io.to(joinedCode).emit("blind_round_ready", { round: next.state.blindRound?.round });
        ack?.({ ok: true, ready });
      },
    );

    socket.on("blind_resolve", (_payload: unknown, ack?: (r: { ok: boolean; error?: string }) => void) => {
      if (!joinedCode) return;
      const fsm = getRoom(joinedCode);
      if (!fsm) return;
      const { fsm: next, error } = serverResolveBlind(fsm);
      if (error) {
        ack?.({ ok: false, error });
        return;
      }
      persist(joinedCode, next);
      io.to(joinedCode).emit("blind_round_resolved", { picks: next.state.picks.slice(-next.state.drafterCount) });
      io.to(joinedCode).emit("room_state", next);
      if (next.phase === "COMPLETE") io.to(joinedCode).emit("room_complete", next.state);
      ack?.({ ok: true });
    });

    socket.on("disconnect", () => {
      if (!joinedCode) return;
      setTimeout(() => {
        const fsm = getRoom(joinedCode!);
        if (!fsm || fsm.phase !== "PICKING") return;
        if (fsm.state.format !== "snake" && fsm.state.format !== "linear") return;
        const autoId = fsm.state.poolIds[0];
        if (!autoId) return;
        const idx = fsm.state.currentPickIndex % fsm.state.drafterCount;
        const card = cardFromPool(poolCards, autoId);
        const { fsm: next } = serverApplyPick(fsm, autoId, idx, card?.name ?? autoId, card?.ovr ?? 70);
        persist(joinedCode!, next);
        io.to(joinedCode!).emit("pick_confirmed", { auto: true, playerId: autoId });
        io.to(joinedCode!).emit("room_state", next);
      }, PICK_TIMER_MS);
    });
  });

  return io;
}

export function createRoomViaHttp(
  modeId: string,
  drafters = 2,
  squadSize = 11,
  format: DraftFormat = "snake",
): { code: string; mode: DraftModeConfig; poolCount: number; format: DraftFormat } {
  const mode = getPresetMode(modeId);
  const pool = buildDraftPool(mode);
  const code = roomCode();
  createRoom(code, mode, pool.map((p) => p.playerId), drafters, squadSize, format);
  return { code, mode, poolCount: pool.length, format };
}
