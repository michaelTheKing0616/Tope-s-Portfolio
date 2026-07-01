import type { DraftModeConfig, DraftRoomState, RatedPlayerCard } from "@sportverse/draftballer-types";
import {
  activeDrafter,
  createDraftRoom,
  makePick,
  squadRating,
  buildDraftPool,
} from "@sportverse/draftballer-core";
import { playerCardHtml } from "./draftballer-hub.js";

type Navigate = (route: string, param?: string) => void;

const DRAFTER_NAMES = ["You", "Rival Bot"];

export function renderDraftballerRoom(root: HTMLElement, navigate: Navigate) {
  const raw = sessionStorage.getItem("db_mode");
  const mode: DraftModeConfig = raw ? JSON.parse(raw) : { id: "all-time-any" };
  const poolCards = buildDraftPool(mode);
  const poolMap = new Map(poolCards.map((c) => [c.playerId, c]));
  let room: DraftRoomState = createDraftRoom(mode, poolCards, 2, 11);

  function botPick() {
    if (room.status !== "picking") return;
    if (activeDrafter(room) !== 1) return;
    const remaining = room.poolIds
      .map((id) => poolMap.get(id)!)
      .filter(Boolean)
      .sort((a, b) => b.ovr - a.ovr);
    const pick = remaining[0];
    if (pick) room = makePick(room, pick.playerId, poolMap, 1);
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
            <button class="btn" id="again">Draft again</button>
            <button class="btn btn--ghost" id="hub">Hub</button>
          </div>
        </div>`;
      root.querySelector("#again")?.addEventListener("click", () => renderDraftballerRoom(root, navigate));
      root.querySelector("#hub")?.addEventListener("click", () => navigate("draftballer"));
      return;
    }

    const turn = activeDrafter(room);
    const isYou = turn === 0;

    root.innerHTML = `
      <div class="shell db-root">
        <button class="btn btn--ghost" id="back">← Exit</button>
        <p class="db-hero__label">${mode.title} · Snake Draft · Pick ${room.currentPickIndex + 1}</p>
        <div class="db-draft-layout">
          <div class="db-order-rail">
            ${DRAFTER_NAMES.map(
              (n, i) =>
                `<div class="db-drafter ${i === turn ? "db-drafter--active" : ""}">${n}<br/><small>${room.rosters[i]!.length}/11</small></div>`,
            ).join("")}
          </div>
          <div>
            <p style="color:var(--db-muted);font-size:0.85rem">${isYou ? "Your pick — tap a card" : "Bot is picking…"}</p>
            <div class="db-pool-grid" id="pool">
              ${room.poolIds
                .slice(0, 48)
                .map((id) => poolMap.get(id)!)
                .filter(Boolean)
                .map((c) => playerCardHtml(c, true))
                .join("")}
            </div>
          </div>
          <div class="panel" style="background:var(--db-panel)">
            <strong>Your XI</strong>
            <div style="margin-top:8px">${room.rosters[0]!.map((id) => `<div style="font-size:0.75rem">${poolMap.get(id)?.name} (${poolMap.get(id)?.ovr})</div>`).join("") || "<span style='color:var(--db-muted)'>No picks yet</span>"}</div>
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
        try {
          room = makePick(room, id, poolMap, 0);
          botPick();
          draw();
        } catch {
          /* ignore invalid pick */
        }
      });
    });
  }

  draw();
}
