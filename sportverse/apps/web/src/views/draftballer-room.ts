import type { DraftModeConfig, DraftRoomState, RatedPlayerCard } from "@sportverse/draftballer-types";
import {
  activeDrafter,
  botAutoPickFromPool,
  createDraftRoom,
  makePick,
  openFormationSlots,
  samplePoolForRoom,
  squadRating,
  buildDraftPool,
  saveSquadForSeason,
} from "@sportverse/draftballer-core";
import { playerCardHtml } from "./draftballer-hub.js";
import { playDraftSound } from "../lib/draft-sound.js";
import { bindIdentityPicker, identityPickerHtml } from "./draftballer-identity.js";
import { keepieLoaderHtml } from "../lib/keepie-loader.js";

type Navigate = (route: string, param?: string) => void;

const DRAFTER_NAMES = ["You", "Rival Bot"];
const ROOM_SEED = `room-${Date.now()}`;

export function renderDraftballerRoom(root: HTMLElement, navigate: Navigate, formatParam?: string) {
  const raw = sessionStorage.getItem("db_mode");
  const mode: DraftModeConfig = raw ? JSON.parse(raw) : { id: "all-time-any", positionLocked: true };
  const poolCards = buildDraftPool(mode);
  const poolMap = new Map(poolCards.map((c) => [c.playerId, c]));
  const gridPool = samplePoolForRoom(poolCards, ROOM_SEED);
  const format = formatParam === "linear" ? "linear" : "snake";
  let room: DraftRoomState = createDraftRoom(mode, poolCards, 2, 11, format);
  const blind = mode.blindRatings ?? false;

  function botPick() {
    if (room.status !== "picking") return;
    if (activeDrafter(room) !== 1) return;
    const open = openFormationSlots(room.rosters[1]!, poolMap, room.squadSize);
    const pick = botAutoPickFromPool(poolCards, room.rosters[1]!, open, mode.difficulty ?? "normal", `${ROOM_SEED}:bot:${room.currentPickIndex}`);
    if (pick) {
      const next = makePick(room, pick.playerId, poolMap, 1);
      if ("error" in next) return;
      room = next;
      playDraftSound("pick");
    }
  }

  function draw() {
    if (room.status === "complete") {
      const youRating = squadRating(room.rosters[0]!, poolMap);
      const botRating = squadRating(room.rosters[1]!, poolMap);
      const winner = youRating >= botRating ? "You win the draft!" : "Bot wins the draft!";
      root.innerHTML = `
        <div class="shell db-root">
          <div class="result" style="text-align:center">
            <p class="db-hero__label">Draft Complete</p>
            <h2 class="db-hero__title" style="font-size:2.5rem">${winner}</h2>
            <p>Your squad OVR: <strong style="color:var(--db-gold)">${youRating}</strong> · Bot: ${botRating}</p>
            <div class="db-pool-grid" style="margin:16px 0">${room.rosters[0]!.map((id) => playerCardHtml(poolMap.get(id)!, true)).join("")}</div>
            ${identityPickerHtml("balanced")}
            <button class="btn" id="simulate">Simulate Season</button>
            <button class="btn" id="again">Draft again</button>
            <button class="btn btn--ghost" id="hub">Hub</button>
          </div>
        </div>`;
      const getIdentity = bindIdentityPicker(root);
      root.querySelector("#simulate")?.addEventListener("click", () => {
        const ids = room.rosters[0]!;
        const cards = ids.map((id) => poolMap.get(id)!).filter(Boolean);
        saveSquadForSeason(mode, ids, cards, youRating, "snake", {
          seed: ROOM_SEED,
          tacticalIdentity: getIdentity(),
          formationId: mode.formationId,
        });
        navigate("draftballer", "season");
      });
      root.querySelector("#again")?.addEventListener("click", () => renderDraftballerRoom(root, navigate, formatParam));
      root.querySelector("#hub")?.addEventListener("click", () => navigate("draftballer"));
      return;
    }

    const turn = activeDrafter(room);
    const isYou = turn === 0;
    const openSlots = openFormationSlots(room.rosters[0]!, poolMap, room.squadSize);
    const nextPos = openSlots[0];

    root.innerHTML = `
      <div class="shell db-root">
        <button class="btn btn--ghost" id="back">← Exit</button>
        <p class="db-hero__label">${mode.title} · ${format === "linear" ? "Linear" : "Snake"} Draft · Pick ${room.currentPickIndex + 1}</p>
        <div class="db-draft-layout">
          <div class="db-order-rail">
            ${DRAFTER_NAMES.map(
              (n, i) =>
                `<div class="db-drafter ${i === turn ? "db-drafter--active" : ""}">${n}<br/><small>${room.rosters[i]!.length}/11</small></div>`,
            ).join("")}
          </div>
          <div>
            <p style="color:var(--db-muted);font-size:0.85rem">${
              isYou
                ? `Your pick — need ${nextPos ?? "any"}`
                : `${keepieLoaderHtml({ size: 48, label: "Bot picking", className: "db-keepie--inline" })}`
            }</p>
            <div class="db-pool-grid" id="pool">
              ${gridPool
                .filter((c) => room.poolIds.includes(c.playerId))
                .slice(0, 60)
                .map((c) => playerCardHtml(c, !blind))
                .join("")}
            </div>
          </div>
          <div class="panel" style="background:var(--db-panel)">
            <strong>Your XI</strong>
            <div style="margin-top:8px">${room.rosters[0]!.map((id) => `<div style="font-size:0.75rem">${poolMap.get(id)?.name} ${blind ? "" : `(${poolMap.get(id)?.ovr})`}</div>`).join("") || "<span style='color:var(--db-muted)'>No picks yet</span>"}</div>
          </div>
        </div>
      </div>`;

    root.querySelector("#back")?.addEventListener("click", () => navigate("draftballer"));

    if (!isYou) {
      setTimeout(() => {
        botPick();
        draw();
      }, 600);
      return;
    }

    root.querySelectorAll(".db-player-card").forEach((el) => {
      el.addEventListener("click", () => {
        const id = (el as HTMLElement).dataset.id!;
        const next = makePick(room, id, poolMap, 0);
        if ("error" in next) return;
        room = next;
        playDraftSound("pick");
        botPick();
        draw();
      });
    });
  }

  draw();
}
