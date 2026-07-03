import type { DraftModeConfig, RatedPlayerCard } from "@sportverse/draftballer-types";
import {
  blindRoundReady,
  botBlindPick,
  buildDraftPool,
  createDraftRoom,
  PRESET_MODES,
  resolveBlindRound,
  saveSquadForSeason,
  squadRating,
  startNextBlindRound,
  submitBlindPick,
} from "@sportverse/draftballer-core";
import { setAwardsData } from "@sportverse/rating-engine";
import { getAwards, getIconicMoments } from "@sportverse/sports-db";
import { playerCardHtml } from "./draftballer-hub.js";

type Navigate = (route: string, param?: string) => void;

const DRAFTER_NAMES = ["You", "Rival Bot"];

function loadMode(): DraftModeConfig {
  const raw = sessionStorage.getItem("db_mode");
  if (raw) return JSON.parse(raw) as DraftModeConfig;
  return PRESET_MODES[0]!;
}

export function renderDraftballerBlind(root: HTMLElement, navigate: Navigate) {
  setAwardsData(getAwards(), getIconicMoments());
  const mode = loadMode();
  const poolCards = buildDraftPool(mode);
  const poolMap = new Map(poolCards.map((c) => [c.playerId, c]));
  let room = createDraftRoom(mode, poolCards, 2, 11, "blind");
  let statusMsg = "";

  function botSubmit() {
    const pick = botBlindPick(room, 1, poolMap);
    if (!pick) return;
    const result = submitBlindPick(room, 1, pick);
    if (!result.error) room = result.room;
  }

  function maybeResolve() {
    if (!blindRoundReady(room)) return;
    const result = resolveBlindRound(room);
    if (result.error) {
      statusMsg = result.error;
      return;
    }
    room = result.room.status === "complete" ? result.room : startNextBlindRound(result.room);
    statusMsg = "";
  }

  function draw() {
    if (room.status === "complete") {
      const youRating = squadRating(room.rosters[0]!, poolMap);
      const botRating = squadRating(room.rosters[1]!, poolMap);
      const winner = youRating >= botRating ? "You win the blind draft!" : "Bot wins the blind draft!";
      root.innerHTML = `
        <div class="shell db-root">
          <div class="result" style="text-align:center">
            <p class="db-hero__label">Blind Draft Complete</p>
            <h2 class="db-hero__title" style="font-size:2.5rem">${winner}</h2>
            <p>Your squad OVR: <strong style="color:var(--db-gold)">${youRating}</strong> · Bot: ${botRating}</p>
            <div class="db-pool-grid" style="margin:16px 0">${room.rosters[0]!.map((id) => playerCardHtml(poolMap.get(id)!, true)).join("")}</div>
            <button class="btn" id="simulate">Simulate Season</button>
            <button class="btn" id="again">Blind draft again</button>
            <button class="btn btn--ghost" id="hub">Hub</button>
          </div>
        </div>`;
      root.querySelector("#simulate")?.addEventListener("click", () => {
        const ids = room.rosters[0]!;
        const cards = ids.map((id) => poolMap.get(id)!).filter(Boolean);
        saveSquadForSeason(mode, ids, cards, youRating, "blind");
        navigate("draftballer", "season");
      });
      root.querySelector("#again")?.addEventListener("click", () => renderDraftballerBlind(root, navigate));
      root.querySelector("#hub")?.addEventListener("click", () => navigate("draftballer"));
      return;
    }

    const round = room.blindRound;
    const youSubmitted = round?.submissions.some((s) => s.drafterIndex === 0) ?? false;
    const botSubmitted = round?.submissions.some((s) => s.drafterIndex === 1) ?? false;
    const ready = blindRoundReady(room);

    root.innerHTML = `
      <div class="shell db-root">
        <button class="btn btn--ghost" id="back">← Exit</button>
        <p class="db-hero__label">${mode.title ?? mode.id} · Blind Draft · Round ${round?.round ?? 1}</p>
        <div class="db-draft-layout">
          <div class="db-order-rail">
            ${DRAFTER_NAMES.map((n, i) => {
              const submitted = round?.submissions.some((s) => s.drafterIndex === i);
              return `<div class="db-drafter ${submitted ? "db-drafter--active" : ""}">${n}<br/><small>${room.rosters[i]!.length}/11${submitted ? " · ✓" : ""}</small></div>`;
            }).join("")}
          </div>
          <div>
            ${
              ready
                ? `<div class="panel" style="margin-bottom:12px"><p style="color:var(--db-emerald-hi)">Round ready — revealing picks…</p></div>`
                : youSubmitted
                  ? `<p style="color:var(--db-muted);font-size:0.85rem">Pick submitted — waiting for bot…</p>`
                  : `<p style="color:var(--db-muted);font-size:0.85rem">Tap a player (hidden from bot until round resolves).</p>`
            }
            ${statusMsg ? `<p style="color:#f87171;font-size:0.85rem;margin-bottom:8px">${statusMsg}</p>` : ""}
            <div class="db-pool-grid">
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

    if (ready) {
      setTimeout(() => {
        maybeResolve();
        if (!botSubmitted && !youSubmitted) botSubmit();
        else if (!botSubmitted) {
          botSubmit();
          maybeResolve();
        }
        draw();
      }, 800);
      return;
    }

    if (!youSubmitted) {
      root.querySelectorAll(".db-player-card").forEach((el) => {
        el.addEventListener("click", () => {
          const id = (el as HTMLElement).dataset.id!;
          const card = poolMap.get(id);
          if (!card) return;
          const result = submitBlindPick(room, 0, card);
          if (result.error) {
            statusMsg = result.error;
            draw();
            return;
          }
          statusMsg = "";
          room = result.room;
          if (!botSubmitted) botSubmit();
          maybeResolve();
          draw();
        });
      });
      return;
    }

    if (!botSubmitted) {
      setTimeout(() => {
        botSubmit();
        maybeResolve();
        draw();
      }, 600);
    }
  }

  draw();
}
