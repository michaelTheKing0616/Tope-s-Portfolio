import type { DraftFormat, DraftModeConfig, DraftRoomState, RatedPlayerCard } from "@sportverse/draftballer-types";
import type { DraftRoomFSM } from "@sportverse/draftballer-core";
import {
  activeDrafter,
  buildDraftPool,
  createDraftRoom,
  makePick,
  maxAffordableBid,
  nominatorIndex,
  PRESET_MODES,
  saveSquadForSeason,
  squadRating,
} from "@sportverse/draftballer-core";
import { setAwardsData } from "@sportverse/rating-engine";
import { getAwards, getIconicMoments } from "@sportverse/sports-db";
import {
  bidAuction,
  blindPick,
  fetchDraftRoom,
  isDraftApiEnabled,
  nominateAuction,
  pickInDraftRoom,
  resolveAuction,
  resolveBlindRound,
  startDraftRoom,
} from "../lib/draft-api.js";
import {
  connectDraftSocket,
  socketBid,
  socketBlindPick,
  socketJoinRoom,
  socketNominate,
  socketPick,
  socketResolveAuction,
  socketResolveBlind,
  socketStartDraft,
  type DraftSocket,
} from "../lib/draft-socket.js";
import { playerCardHtml } from "./draftballer-hub.js";

type Navigate = (route: string, param?: string) => void;

const DRAFTER_LABELS = ["Drafter 1", "Drafter 2", "Drafter 3", "Drafter 4"];

function loadMode(): DraftModeConfig {
  const raw = sessionStorage.getItem("db_mode");
  if (raw) return JSON.parse(raw) as DraftModeConfig;
  return PRESET_MODES[0]!;
}

function loadFormat(): DraftFormat {
  return (sessionStorage.getItem("db_mp_format") as DraftFormat) ?? "snake";
}

function isHost(): boolean {
  return sessionStorage.getItem("db_mp_host") === "1";
}

function formatLabel(format: DraftFormat): string {
  return format.charAt(0).toUpperCase() + format.slice(1);
}

export function renderDraftballerMpRoom(root: HTMLElement, roomCode: string, navigate: Navigate) {
  setAwardsData(getAwards(), getIconicMoments());
  const mode = loadMode();
  const format = loadFormat();
  const pool = buildDraftPool(mode);
  const poolMap = new Map(pool.map((p) => [p.playerId, p]));

  let fsm: DraftRoomFSM | null = null;
  let drafterIndex = isHost() ? 0 : 1;
  let socket: DraftSocket | null = null;
  let useRest = false;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let statusMsg = "";
  let blindRoundReadyFlag = false;
  let destroyed = false;

  function cleanup() {
    destroyed = true;
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    socket?.removeAllListeners();
    socket?.disconnect();
    socket = null;
  }

  function onComplete(state: DraftRoomState) {
    cleanup();
    const roster = state.rosters[drafterIndex] ?? [];
    if (roster.length === 0) {
      navigate("draftballer", "mp-lobby");
      return;
    }
    const cards = roster.map((id) => poolMap.get(id)).filter(Boolean) as RatedPlayerCard[];
    const ovr = squadRating(roster, poolMap);
    saveSquadForSeason(mode, roster, cards, ovr, "mp");
    navigate("draftballer", "season");
  }

  function applyFsm(next: DraftRoomFSM) {
    fsm = next;
    if (next.phase === "COMPLETE" || next.state.status === "complete") {
      onComplete(next.state);
    }
  }

  function setupSocketListeners(sock: DraftSocket) {
    sock.on("room_state", (next: DraftRoomFSM) => {
      if (destroyed) return;
      fsm = next;
      draw();
    });
    sock.on("room_complete", (state: DraftRoomState) => {
      if (destroyed) return;
      onComplete(state);
    });
    sock.on("blind_round_ready", () => {
      if (destroyed) return;
      blindRoundReadyFlag = true;
      draw();
    });
    sock.on("blind_round_resolved", () => {
      if (destroyed) return;
      blindRoundReadyFlag = false;
    });
  }

  async function restRefresh() {
    try {
      const next = await fetchDraftRoom(roomCode);
      applyFsm(next);
      if (!destroyed && fsm) draw();
    } catch {
      /* polling errors are non-fatal */
    }
  }

  async function connectLive() {
    const sock = connectDraftSocket();
    if (!sock) {
      useRest = true;
      return connectRest();
    }

    socket = sock;
    setupSocketListeners(sock);

    try {
      const ack = await socketJoinRoom(sock, roomCode);
      if (!ack.ok || !ack.fsm) throw new Error(ack.error ?? "Join failed");
      const joined = ack.fsm;
      fsm = joined;
      drafterIndex = ack.drafterIndex ?? (isHost() ? 0 : 1);

      if (isHost() && (joined.phase === "LOBBY" || joined.phase === "POOL_READY")) {
        const start = await socketStartDraft(sock);
        if (!start.ok) statusMsg = start.error ?? "Could not start draft";
      }
      draw();
      return;
    } catch (e) {
      statusMsg = e instanceof Error ? e.message : "Socket join failed — using REST";
      sock.removeAllListeners();
      sock.disconnect();
      socket = null;
      useRest = true;
      await connectRest();
    }
  }

  async function connectRest() {
    try {
      const loaded = await fetchDraftRoom(roomCode);
      fsm = loaded;
      drafterIndex = isHost() ? 0 : Math.min(loaded.state.drafterCount - 1, 1);
      if (isHost() && (loaded.phase === "LOBBY" || loaded.phase === "POOL_READY")) {
        fsm = await startDraftRoom(roomCode);
      }
      pollTimer = setInterval(() => void restRefresh(), 3000);
      draw();
    } catch (e) {
      statusMsg = e instanceof Error ? e.message : "Could not load room";
      drawError();
    }
  }

  function drawError() {
    root.innerHTML = `
      <div class="shell db-root">
        <button class="btn btn--ghost" id="back">← Lobby</button>
        <header class="db-hero">
          <p class="db-hero__label">Room ${roomCode}</p>
          <h1 class="db-hero__title">DRAFT UNAVAILABLE</h1>
          <p class="db-hero__sub">${statusMsg || "Could not connect to draft room."}</p>
        </header>
        <div class="panel">
          <p style="color:var(--db-muted);font-size:0.85rem">Set VITE_API_URL and ensure the draft API is running for live multiplayer.</p>
        </div>
      </div>`;
    root.querySelector("#back")?.addEventListener("click", () => {
      cleanup();
      navigate("draftballer", "mp-lobby");
    });
  }

  function drawLocalSnake() {
    let room = createDraftRoom(mode, pool, 2, 11, "snake");

    function localDraw() {
      if (room.status === "complete") {
        cleanup();
        const roster = room.rosters[0]!;
        const cards = roster.map((id) => poolMap.get(id)!).filter(Boolean);
        const ovr = squadRating(roster, poolMap);
        saveSquadForSeason(mode, roster, cards, ovr, "mp");
        navigate("draftballer", "season");
        return;
      }

      const turn = activeDrafter(room);
      const isYou = turn === 0;
      const available = room.poolIds.slice(0, 48);

      root.innerHTML = `
        <div class="shell db-root">
          <button class="btn btn--ghost" id="back">← Lobby</button>
          <header class="db-hero">
            <p class="db-hero__label">Room ${roomCode} · Local preview</p>
            <h1 class="db-hero__title">SNAKE DRAFT</h1>
            <p class="db-hero__sub">${mode.title ?? mode.id} · Pick ${room.currentPickIndex + 1} · ${room.rosters[0]!.length}/11</p>
          </header>
          <div class="panel" style="margin-bottom:12px">
            <p style="color:var(--db-muted);font-size:0.85rem">Live API disabled — local snake draft only. Set VITE_API_URL for real multiplayer.</p>
          </div>
          <p style="color:var(--db-muted);font-size:0.85rem;margin-bottom:8px">${isYou ? "Your pick — tap a card" : "Waiting for opponent…"}</p>
          <div class="db-pool-grid">
            ${available
              .map((id) => poolMap.get(id))
              .filter(Boolean)
              .map((c) => playerCardHtml(c!, true))
              .join("")}
          </div>
        </div>`;

      root.querySelector("#back")?.addEventListener("click", () => {
        cleanup();
        navigate("draftballer", "mp-lobby");
      });

      if (!isYou) return;

      root.querySelectorAll(".db-player-card").forEach((el) => {
        el.addEventListener("click", () => {
          const id = (el as HTMLElement).dataset.id!;
          try {
            room = makePick(room, id, poolMap, 0);
            localDraw();
          } catch {
            /* invalid pick */
          }
        });
      });
    }

    localDraw();
  }

  function drawUnsupportedFormat() {
    root.innerHTML = `
      <div class="shell db-root">
        <button class="btn btn--ghost" id="back">← Lobby</button>
        <header class="db-hero">
          <p class="db-hero__label">Room ${roomCode}</p>
          <h1 class="db-hero__title">${formatLabel(format).toUpperCase()} DRAFT</h1>
          <p class="db-hero__sub">Requires live API — set VITE_API_URL for ${format} multiplayer.</p>
        </header>
        <div class="panel">
          <p style="color:var(--db-muted);font-size:0.85rem">Local preview supports snake only. Try snake format or enable the draft API.</p>
        </div>
      </div>`;
    root.querySelector("#back")?.addEventListener("click", () => {
      cleanup();
      navigate("draftballer", "mp-lobby");
    });
  }

  function drafterRail(state: DraftRoomState): string {
    const turn = state.format === "auction" ? nominatorIndex(state) : activeDrafter(state);
    return state.rosters
      .map((r, i) => {
        const budget =
          state.format === "auction" && state.budgets ? `<br/><small>£${state.budgets[i]}</small>` : "";
        return `<div class="db-drafter ${i === turn ? "db-drafter--active" : ""} ${i === drafterIndex ? "db-drafter--you" : ""}">${DRAFTER_LABELS[i] ?? `P${i + 1}`}${i === drafterIndex ? " (you)" : ""}<br/><small>${r.length}/${state.squadSize}</small>${budget}</div>`;
      })
      .join("");
  }

  function auctionPanel(state: DraftRoomState): string {
    const lot = state.auctionLot;
    if (!lot || lot.status !== "open") {
      if (nominatorIndex(state) === drafterIndex) {
        return `<p style="color:var(--db-muted);font-size:0.85rem">You nominate — tap a player below.</p>`;
      }
      return `<p style="color:var(--db-muted);font-size:0.85rem">Waiting for nomination…</p>`;
    }

    const maxBid = maxAffordableBid(state, drafterIndex);
    return `
      <div class="panel" style="margin-bottom:12px">
        <strong>${lot.playerName}</strong> · OVR ${lot.ovr}<br/>
        High bid: <strong style="color:var(--db-gold)">${lot.highBid}</strong>
        ${lot.highBidder !== null ? ` (Drafter ${lot.highBidder + 1})` : ""}
        <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
          <input id="bid-amt" type="number" min="${lot.highBid + 1}" max="${maxBid}" value="${Math.min(maxBid, lot.highBid + 1)}" class="btn btn--ghost" style="width:80px" />
          <button class="btn" id="bid-btn" ${maxBid < lot.highBid + 1 ? "disabled" : ""}>Bid (max ${maxBid})</button>
          <button class="btn btn--ghost" id="resolve-btn">Resolve lot</button>
        </div>
      </div>`;
  }

  function blindPanel(state: DraftRoomState): string {
    const round = state.blindRound;
    const submitted = round?.submissions.some((s) => s.drafterIndex === drafterIndex) ?? false;
    if (submitted) {
      if (blindRoundReadyFlag || (round && round.submissions.length >= state.drafterCount)) {
        return `
          <div class="panel" style="margin-bottom:12px">
            <p style="color:var(--db-emerald-hi)">Round ready — resolve to reveal picks.</p>
            <button class="btn" id="blind-resolve">Resolve round</button>
          </div>`;
      }
      return `<p style="color:var(--db-muted);font-size:0.85rem">Pick submitted — waiting for others…</p>`;
    }
    return `<p style="color:var(--db-muted);font-size:0.85rem">Blind round ${round?.round ?? 1} — tap a player (hidden from rivals).</p>`;
  }

  function pickPanel(state: DraftRoomState): string {
    const turn = activeDrafter(state);
    if (turn === drafterIndex) {
      return `<p style="color:var(--db-muted);font-size:0.85rem">Your pick — tap a card.</p>`;
    }
    return `<p style="color:var(--db-muted);font-size:0.85rem">Waiting for Drafter ${turn + 1}…</p>`;
  }

  async function sendPick(card: RatedPlayerCard) {
    if (!fsm) return;
    statusMsg = "";
    if (socket && !useRest) {
      const ack = await socketPick(socket, { playerId: card.playerId, playerName: card.name, ovr: card.ovr });
      if (!ack.ok) statusMsg = ack.error ?? "Pick rejected";
    } else {
      try {
        const next = await pickInDraftRoom(roomCode, {
          playerId: card.playerId,
          playerName: card.name,
          ovr: card.ovr,
          drafterIndex,
        });
        applyFsm(next);
      } catch (e) {
        statusMsg = e instanceof Error ? e.message : "Pick failed";
      }
    }
    draw();
  }

  async function sendNominate(card: RatedPlayerCard) {
    if (!fsm) return;
    statusMsg = "";
    if (socket && !useRest) {
      const ack = await socketNominate(socket, { playerId: card.playerId, nominatorIndex: drafterIndex });
      if (!ack.ok) statusMsg = ack.error ?? "Nomination failed";
    } else {
      try {
        const next = await nominateAuction(roomCode, { playerId: card.playerId, nominatorIndex: drafterIndex });
        applyFsm(next);
      } catch (e) {
        statusMsg = e instanceof Error ? e.message : "Nomination failed";
      }
    }
    draw();
  }

  async function sendBid(amount: number) {
    if (!fsm) return;
    statusMsg = "";
    if (socket && !useRest) {
      const ack = await socketBid(socket, { drafterIndex, amount });
      if (!ack.ok) statusMsg = ack.error ?? "Bid rejected";
    } else {
      try {
        const next = await bidAuction(roomCode, { drafterIndex, amount });
        applyFsm(next);
      } catch (e) {
        statusMsg = e instanceof Error ? e.message : "Bid failed";
      }
    }
    draw();
  }

  async function sendResolveAuction() {
    if (!fsm) return;
    statusMsg = "";
    if (socket && !useRest) {
      const ack = await socketResolveAuction(socket);
      if (!ack.ok) statusMsg = ack.error ?? "Resolve failed";
    } else {
      try {
        const next = await resolveAuction(roomCode);
        applyFsm(next);
      } catch (e) {
        statusMsg = e instanceof Error ? e.message : "Resolve failed";
      }
    }
    draw();
  }

  async function sendBlindPick(card: RatedPlayerCard) {
    if (!fsm) return;
    statusMsg = "";
    if (socket && !useRest) {
      const ack = await socketBlindPick(socket, { playerId: card.playerId, drafterIndex });
      if (!ack.ok) statusMsg = ack.error ?? "Blind pick failed";
      else if (ack.ready) blindRoundReadyFlag = true;
    } else {
      try {
        const res = await blindPick(roomCode, { playerId: card.playerId, drafterIndex });
        if (res.blindRoundReady) blindRoundReadyFlag = true;
        applyFsm(res);
      } catch (e) {
        statusMsg = e instanceof Error ? e.message : "Blind pick failed";
      }
    }
    draw();
  }

  async function sendBlindResolve() {
    if (!fsm) return;
    statusMsg = "";
    if (socket && !useRest) {
      const ack = await socketResolveBlind(socket);
      if (!ack.ok) statusMsg = ack.error ?? "Resolve failed";
      else blindRoundReadyFlag = false;
    } else {
      try {
        const next = await resolveBlindRound(roomCode);
        blindRoundReadyFlag = false;
        applyFsm(next);
      } catch (e) {
        statusMsg = e instanceof Error ? e.message : "Resolve failed";
      }
    }
    draw();
  }

  function canInteractWithPool(state: DraftRoomState): boolean {
    if (state.status !== "picking") return false;
    if (state.format === "snake" || state.format === "linear") {
      return activeDrafter(state) === drafterIndex;
    }
    if (state.format === "auction") {
      const lot = state.auctionLot;
      if (!lot || lot.status !== "open") return nominatorIndex(state) === drafterIndex;
      return true;
    }
    if (state.format === "blind") {
      const round = state.blindRound;
      return !(round?.submissions.some((s) => s.drafterIndex === drafterIndex) ?? false);
    }
    return false;
  }

  function draw() {
    if (!fsm) return;
    const state = fsm.state;
    const myRoster = state.rosters[drafterIndex] ?? [];
    const poolSlice = state.poolIds.slice(0, 48);
    const connLabel = useRest ? "REST sync" : socket ? "Live WebSocket" : "Offline";

    let formatHint = "";
    if (state.format === "auction") formatHint = auctionPanel(state);
    else if (state.format === "blind") formatHint = blindPanel(state);
    else formatHint = pickPanel(state);

    root.innerHTML = `
      <div class="shell db-root">
        <button class="btn btn--ghost" id="back">← Lobby</button>
        <header class="db-hero">
          <p class="db-hero__label">Room ${roomCode} · ${connLabel}</p>
          <h1 class="db-hero__title">${formatLabel(state.format).toUpperCase()} DRAFT</h1>
          <p class="db-hero__sub">${mode.title ?? mode.id} · ${state.picks.length} picks · You: ${myRoster.length}/${state.squadSize}</p>
        </header>
        <div class="db-draft-layout">
          <div class="db-order-rail">${drafterRail(state)}</div>
          <div>
            ${formatHint}
            ${statusMsg ? `<p style="color:#f87171;font-size:0.85rem;margin-bottom:8px">${statusMsg}</p>` : ""}
            <div class="db-pool-grid">
              ${poolSlice
                .map((id) => poolMap.get(id))
                .filter(Boolean)
                .map((c) => playerCardHtml(c!, true))
                .join("")}
            </div>
          </div>
          <div class="panel" style="background:var(--db-panel)">
            <strong>Your squad</strong>
            <div style="margin-top:8px">
              ${myRoster.length
                ? myRoster
                    .map((id) => {
                      const p = poolMap.get(id);
                      return p ? `<div style="font-size:0.75rem">${p.name} (${p.ovr})</div>` : "";
                    })
                    .join("")
                : "<span style='color:var(--db-muted)'>No picks yet</span>"}
            </div>
          </div>
        </div>
      </div>`;

    root.querySelector("#back")?.addEventListener("click", () => {
      cleanup();
      navigate("draftballer", "mp-lobby");
    });

    root.querySelector("#bid-btn")?.addEventListener("click", () => {
      const amt = Number((root.querySelector("#bid-amt") as HTMLInputElement).value);
      if (Number.isFinite(amt)) void sendBid(amt);
    });
    root.querySelector("#resolve-btn")?.addEventListener("click", () => void sendResolveAuction());
    root.querySelector("#blind-resolve")?.addEventListener("click", () => void sendBlindResolve());

    if (!canInteractWithPool(state)) return;

    root.querySelectorAll(".db-player-card").forEach((el) => {
      el.addEventListener("click", () => {
        const id = (el as HTMLElement).dataset.id!;
        const card = poolMap.get(id);
        if (!card || !state.poolIds.includes(id)) return;
        if (state.format === "auction" && (!state.auctionLot || state.auctionLot.status !== "open")) {
          void sendNominate(card);
        } else if (state.format === "blind") {
          void sendBlindPick(card);
        } else {
          void sendPick(card);
        }
      });
    });
  }

  if (!isDraftApiEnabled()) {
    if (format === "snake") drawLocalSnake();
    else drawUnsupportedFormat();
    return;
  }

  void connectLive();
}
