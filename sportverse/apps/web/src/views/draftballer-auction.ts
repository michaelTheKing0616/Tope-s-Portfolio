import type { DraftModeConfig, DraftRoomState } from "@sportverse/draftballer-types";
import {
  botAuctionBid,
  botNominatePlayer,
  buildDraftPool,
  clearResolvedLot,
  createDraftRoom,
  maxAffordableBid,
  nominatorIndex,
  openAuctionLot,
  placeAuctionBid,
  PRESET_MODES,
  resolveAuctionLot,
  saveSquadForSeason,
  squadRating,
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

function runBotBids(room: DraftRoomState): DraftRoomState {
  let next = room;
  for (let i = 0; i < next.drafterCount; i++) {
    if (i === 0) continue;
    const bid = botAuctionBid(next, i);
    if (bid === null) continue;
    const result = placeAuctionBid(next, i, bid);
    if (!result.error) next = result.room;
  }
  return next;
}

export function renderDraftballerAuction(root: HTMLElement, navigate: Navigate) {
  setAwardsData(getAwards(), getIconicMoments());
  const mode = loadMode();
  const poolCards = buildDraftPool(mode);
  const poolMap = new Map(poolCards.map((c) => [c.playerId, c]));
  let room = createDraftRoom(mode, poolCards, 2, 11, "auction");
  let statusMsg = "";

  function botTurn() {
    if (room.status !== "picking") return;

    const lot = room.auctionLot;
    if (!lot || lot.status !== "open") {
      const nominee = botNominatePlayer(room, poolMap);
      if (nominee && nominatorIndex(room) === 1) {
        room = openAuctionLot(room, nominee, 1);
        room = runBotBids(room);
      }
      return;
    }

    room = runBotBids(room);
  }

  function afterResolve() {
    room = clearResolvedLot(room);
    if (room.status === "picking" && nominatorIndex(room) === 1) {
      botTurn();
    }
  }

  function draw() {
    if (room.status === "complete") {
      const youRating = squadRating(room.rosters[0]!, poolMap);
      const botRating = squadRating(room.rosters[1]!, poolMap);
      const winner = youRating >= botRating ? "You win the auction!" : "Bot wins the auction!";
      root.innerHTML = `
        <div class="shell db-root">
          <div class="result" style="text-align:center">
            <p class="db-hero__label">Auction Complete</p>
            <h2 class="db-hero__title" style="font-size:2.5rem">${winner}</h2>
            <p>Your squad OVR: <strong style="color:var(--db-gold)">${youRating}</strong> · Bot: ${botRating}</p>
            <div class="db-pool-grid" style="margin:16px 0">${room.rosters[0]!.map((id) => playerCardHtml(poolMap.get(id)!, true)).join("")}</div>
            <button class="btn" id="simulate">Simulate Season</button>
            <button class="btn" id="again">Auction again</button>
            <button class="btn btn--ghost" id="hub">Hub</button>
          </div>
        </div>`;
      root.querySelector("#simulate")?.addEventListener("click", () => {
        const ids = room.rosters[0]!;
        const cards = ids.map((id) => poolMap.get(id)!).filter(Boolean);
        saveSquadForSeason(mode, ids, cards, youRating, "auction");
        navigate("draftballer", "season");
      });
      root.querySelector("#again")?.addEventListener("click", () => renderDraftballerAuction(root, navigate));
      root.querySelector("#hub")?.addEventListener("click", () => navigate("draftballer"));
      return;
    }

    const lot = room.auctionLot;
    const nomIdx = nominatorIndex(room);
    const isYourNomination = nomIdx === 0 && (!lot || lot.status !== "open");
    const maxBid = maxAffordableBid(room, 0);

    root.innerHTML = `
      <div class="shell db-root">
        <button class="btn btn--ghost" id="back">← Exit</button>
        <p class="db-hero__label">${mode.title ?? mode.id} · Auction · Lot ${room.picks.length + 1}</p>
        <div class="db-draft-layout">
          <div class="db-order-rail">
            ${DRAFTER_NAMES.map((n, i) => {
              const budget = room.budgets?.[i] ?? 0;
              return `<div class="db-drafter ${nomIdx === i && !lot ? "db-drafter--active" : ""}">${n}<br/><small>${room.rosters[i]!.length}/11 · £${budget}</small></div>`;
            }).join("")}
          </div>
          <div>
            ${
              lot && lot.status === "open"
                ? `<div class="panel" style="margin-bottom:12px">
                    <strong>${lot.playerName}</strong> · OVR ${lot.ovr}<br/>
                    High bid: <strong style="color:var(--db-gold)">${lot.highBid}</strong>
                    ${lot.highBidder !== null ? ` (${DRAFTER_NAMES[lot.highBidder]})` : ""}
                    <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
                      <input id="bid-amt" type="number" min="${lot.highBid + 1}" max="${maxBid}" value="${Math.min(maxBid, lot.highBid + 1)}" class="btn btn--ghost" style="width:80px" />
                      <button class="btn" id="bid-btn" ${maxBid < lot.highBid + 1 ? "disabled" : ""}>Bid (max ${maxBid})</button>
                      <button class="btn btn--ghost" id="resolve-btn">Resolve lot</button>
                    </div>
                  </div>`
                : isYourNomination
                  ? `<p style="color:var(--db-muted);font-size:0.85rem">You nominate — tap a player.</p>`
                  : `<p style="color:var(--db-muted);font-size:0.85rem">Bot is nominating…</p>`
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

    root.querySelector("#bid-btn")?.addEventListener("click", () => {
      if (!lot || lot.status !== "open") return;
      const amt = Number((root.querySelector("#bid-amt") as HTMLInputElement).value);
      const result = placeAuctionBid(room, 0, amt);
      if (result.error) {
        statusMsg = result.error;
        draw();
        return;
      }
      statusMsg = "";
      room = result.room;
      room = runBotBids(room);
      draw();
    });

    root.querySelector("#resolve-btn")?.addEventListener("click", () => {
      const result = resolveAuctionLot(room);
      if (result.error) {
        statusMsg = result.error;
        draw();
        return;
      }
      statusMsg = "";
      room = result.room;
      afterResolve();
      draw();
    });

    if (isYourNomination) {
      root.querySelectorAll(".db-player-card").forEach((el) => {
        el.addEventListener("click", () => {
          const id = (el as HTMLElement).dataset.id!;
          const card = poolMap.get(id);
          if (!card) return;
          try {
            room = openAuctionLot(room, card, 0);
            room = runBotBids(room);
            statusMsg = "";
            draw();
          } catch (e) {
            statusMsg = e instanceof Error ? e.message : "Cannot nominate";
            draw();
          }
        });
      });
      return;
    }

    if (nomIdx === 1 && (!lot || lot.status !== "open")) {
      setTimeout(() => {
        botTurn();
        draw();
      }, 600);
    }
  }

  draw();
}
