import type { DraftModeConfig, DraftRoomState, RatedPlayerCard } from "@sportverse/draftballer-types";
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
import { bindIdentityPicker, identityPickerHtml } from "./draftballer-identity.js";
import { bindEliteMotion } from "../lib/elite-motion.js";
import { keepieLoaderHtml } from "../lib/keepie-loader.js";

/** elite-anim-v1 — Stitch auction_draft_pro_animated motion */
const UI_BUILD = "elite-anim-v1";

type Navigate = (route: string, param?: string) => void;

const DRAFTER_NAMES = ["You", "Rival Bot"];

type BidLogEntry = { drafterIndex: number; amount: number };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatBudget(amount: number): string {
  return `£${amount.toLocaleString()}`;
}

function fameTierLabel(card: RatedPlayerCard): string {
  const map: Record<string, string> = {
    icon: "ICONIC",
    star: "LEGENDARY",
    known: "RARE",
    cult: "UNCOMMON",
    obscure: "COMMON",
  };
  if (card.ovr >= 90) return "ICONIC";
  if (card.ovr >= 86) return "LEGENDARY";
  if (card.ovr >= 80) return "RARE";
  return map[card.fameTier] ?? "COMMON";
}

function tacticalFitBars(card: RatedPlayerCard | undefined): string {
  if (!card) {
    return ["PAS", "DRI", "SHO"].map((label) => statBarHtml(label, 70)).join("");
  }
  const attrs = card.attributes;
  const rows = [
    { label: "PASSING", value: attrs.pas },
    { label: "DRIBBLING", value: attrs.dri },
    { label: "SHOOTING", value: attrs.sho },
  ];
  return rows.map((r) => statBarHtml(r.label, r.value)).join("");
}

function statBarHtml(label: string, value: number): string {
  const pct = Math.max(4, Math.min(100, value));
  return `
    <div class="db-auction-stat">
      <div class="db-auction-stat__head">
        <span>${label}</span>
        <span class="db-auction-stat__val">${value}</span>
      </div>
      <div class="db-auction-stat__track">
        <div class="db-auction-stat__fill" style="width:${pct}%"></div>
      </div>
    </div>`;
}

function showcaseCardHtml(card: RatedPlayerCard): string {
  return `
    <div class="db-auction-showcase">
      <div class="db-auction-showcase__glow" aria-hidden="true"></div>
      <div class="db-auction-showcase__card db-glass">
        <div class="db-auction-showcase__face">
          <div class="db-auction-showcase__rating">
            <span class="db-auction-showcase__ovr">${card.ovr}</span>
            <span class="db-label-caps db-auction-showcase__pos">${card.position}</span>
          </div>
          <div class="db-auction-showcase__data-panel">
            <div class="db-auction-showcase__stat-grid">
              <span>PAC ${card.attributes.pac}</span>
              <span>SHO ${card.attributes.sho}</span>
              <span>PAS ${card.attributes.pas}</span>
              <span>DRI ${card.attributes.dri}</span>
              <span>DEF ${card.attributes.def}</span>
              <span>PHY ${card.attributes.phy}</span>
            </div>
          </div>
        </div>
        <footer class="db-auction-showcase__footer">
          <h2 class="db-auction-showcase__name">${escapeHtml(card.name)}</h2>
          <div class="db-auction-showcase__meta">
            <span class="db-auction-showcase__nation">${escapeHtml(card.nationality)}</span>
            <span class="db-label-caps">${fameTierLabel(card)}</span>
          </div>
        </footer>
      </div>
    </div>`;
}

function nomPoolCardHtml(card: RatedPlayerCard): string {
  return `
    <button type="button" class="db-auction-nom-card db-glass" data-id="${card.playerId}">
      <span class="db-auction-nom-card__ovr">${card.ovr}</span>
      <span class="db-label-caps db-auction-nom-card__pos">${card.position}</span>
      <span class="db-auction-nom-card__name">${escapeHtml(card.name)}</span>
      <span class="db-auction-nom-card__tier">${fameTierLabel(card)}</span>
      <span class="db-auction-nom-card__club">${escapeHtml(card.contextLine ?? card.nationality)}</span>
    </button>`;
}

function squadDataCardHtml(card: RatedPlayerCard): string {
  return `
    <div class="db-auction-squad-card db-glass">
      <span class="db-auction-squad-card__ovr">${card.ovr}</span>
      <div>
        <span class="db-label-caps">${card.position}</span>
        <span class="db-auction-squad-card__name">${escapeHtml(card.name)}</span>
      </div>
    </div>`;
}

function bidActivityHtml(lot: NonNullable<DraftRoomState["auctionLot"]>, log: BidLogEntry[]): string {
  const entries: { name: string; amount: number; leader: boolean; bot: boolean }[] = [];

  if (log.length === 0) {
    entries.push({
      name: DRAFTER_NAMES[lot.nominatorIndex] ?? "Nominator",
      amount: 1,
      leader: lot.highBidder === null,
      bot: lot.nominatorIndex !== 0,
    });
  } else {
    for (let i = log.length - 1; i >= 0; i--) {
      const entry = log[i]!;
      const isLeader = entry.amount === lot.highBid && entry.drafterIndex === lot.highBidder;
      entries.push({
        name: DRAFTER_NAMES[entry.drafterIndex] ?? `Drafter ${entry.drafterIndex}`,
        amount: entry.amount,
        leader: isLeader,
        bot: entry.drafterIndex !== 0,
      });
    }
  }

  const unique = entries.slice(0, 6);
  if (unique.length === 0) {
    return `<p class="db-auction-activity__empty">No bids yet</p>`;
  }

  return unique
    .map((e) => {
      const leaderTag = e.leader ? " (Leader)" : "";
      const rowClass = e.leader ? " db-auction-activity__row--leader" : e.bot ? "" : " db-auction-activity__row--you";
      return `
        <div class="db-auction-activity__row${rowClass}">
          <span class="db-auction-activity__who">${escapeHtml(e.name)}${leaderTag}</span>
          <span class="db-auction-activity__amt">${formatBudget(e.amount)}</span>
        </div>`;
    })
    .join("");
}

function auctionTopBar(budget: number, lotNum: number): string {
  return `
    <header class="db-auction-topbar">
      <div class="db-auction-topbar__brand">
        <div class="db-auction-topbar__badge" aria-hidden="true">LV</div>
        <h1 class="db-auction-topbar__title">DRAFTBALLER</h1>
        <span class="db-label-caps db-auction-topbar__lot">Lot ${lotNum}</span>
      </div>
      <div class="db-auction-topbar__budget db-soft-pulse">
        <span class="db-label-caps">BUDGET</span>
        <span class="db-auction-topbar__budget-val">${formatBudget(budget)}</span>
      </div>
      <button type="button" class="db-auction-topbar__exit" id="back">Exit</button>
    </header>`;
}

function loadMode(): DraftModeConfig {
  const raw = sessionStorage.getItem("db_mode");
  if (raw) return JSON.parse(raw) as DraftModeConfig;
  return PRESET_MODES[0]!;
}

function runBotBids(room: DraftRoomState, onBid: (drafterIndex: number, amount: number) => void): DraftRoomState {
  let next = room;
  for (let i = 0; i < next.drafterCount; i++) {
    if (i === 0) continue;
    const bid = botAuctionBid(next, i);
    if (bid === null) continue;
    const result = placeAuctionBid(next, i, bid);
    if (!result.error) {
      onBid(i, bid);
      next = result.room;
    }
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
  let bidLog: BidLogEntry[] = [];
  let lastLotId: string | null = null;
  let timerSeconds = 14;
  let timerMs = 22;
  let timerHandle: ReturnType<typeof setInterval> | null = null;
  let timerCritical = false;

  function bindPageMotion() {
    const pageRoot = root.querySelector(".db-root") as HTMLElement | null;
    if (pageRoot) bindEliteMotion(pageRoot, { scan: "line" });
  }

  function clearTimer() {
    if (timerHandle) {
      clearInterval(timerHandle);
      timerHandle = null;
    }
  }

  function resetTimer() {
    timerSeconds = 14;
    timerMs = 22;
    timerCritical = false;
  }

  function syncLotBidLog(lot: DraftRoomState["auctionLot"]) {
    if (!lot || lot.status !== "open") return;
    if (lot.playerId !== lastLotId) {
      lastLotId = lot.playerId;
      bidLog = [];
      resetTimer();
    }
  }

  function pushBid(drafterIndex: number, amount: number) {
    bidLog.push({ drafterIndex, amount });
    resetTimer();
  }

  function startTimer() {
    clearTimer();
    timerHandle = setInterval(() => {
      timerMs -= 4;
      if (timerMs < 0) {
        timerMs = 99;
        timerSeconds -= 1;
      }
      if (timerSeconds < 0) timerSeconds = 14;
      timerCritical = timerSeconds < 10;
      const el = root.querySelector("#db-auction-timer");
      if (!el) return;
      const s = String(timerSeconds).padStart(2, "0");
      const ms = String(timerMs).padStart(2, "0");
      el.textContent = `00:${s}.${ms}`;
      el.classList.toggle("db-auction-timer--critical", timerCritical);
    }, 40);
  }

  function botTurn() {
    if (room.status !== "picking") return;

    const lot = room.auctionLot;
    if (!lot || lot.status !== "open") {
      const nominee = botNominatePlayer(room, poolMap);
      if (nominee && nominatorIndex(room) === 1) {
        room = openAuctionLot(room, nominee, 1);
        syncLotBidLog(room.auctionLot);
        room = runBotBids(room, pushBid);
      }
      return;
    }

    room = runBotBids(room, pushBid);
  }

  function afterResolve() {
    room = clearResolvedLot(room);
    lastLotId = null;
    bidLog = [];
    clearTimer();
    if (room.status === "picking" && nominatorIndex(room) === 1) {
      botTurn();
    }
  }

  function bindBidControls(lot: NonNullable<DraftRoomState["auctionLot"]>) {
    const maxBid = maxAffordableBid(room, 0);
    const minBid = lot.highBidder === null ? 1 : lot.highBid + 1;
    const slider = root.querySelector("#bid-slider") as HTMLInputElement | null;
    const bidVal = root.querySelector("#bid-value");
    const bidAmt = root.querySelector("#bid-amt") as HTMLInputElement | null;

    const syncBidDisplay = (val: number) => {
      if (bidVal) bidVal.textContent = formatBudget(val);
      if (bidAmt) bidAmt.value = String(val);
      if (slider) slider.value = String(val);
    };

    const clampBid = (val: number) => Math.min(maxBid, Math.max(minBid, val));

    slider?.addEventListener("input", () => {
      syncBidDisplay(clampBid(Number(slider.value)));
    });

    root.querySelectorAll("[data-bid-delta]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const delta = (btn as HTMLElement).dataset.bidDelta;
        const current = Number(bidAmt?.value ?? minBid);
        if (delta === "max") syncBidDisplay(maxBid);
        else syncBidDisplay(clampBid(current + Number(delta)));
      });
    });

    root.querySelector("#bid-btn")?.addEventListener("click", () => {
      const amt = Number(bidAmt?.value ?? minBid);
      const result = placeAuctionBid(room, 0, amt);
      if (result.error) {
        statusMsg = result.error;
        draw();
        return;
      }
      statusMsg = "";
      pushBid(0, amt);
      room = result.room;
      room = runBotBids(room, pushBid);
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
  }

  function draw() {
    if (room.status === "complete") {
      clearTimer();
      const youRating = squadRating(room.rosters[0]!, poolMap);
      const botRating = squadRating(room.rosters[1]!, poolMap);
      const winner = youRating >= botRating ? "You win the auction!" : "Bot wins the auction!";
      root.innerHTML = `
        <div class="shell db-root db-auction-page">
          <div class="db-auction-result db-glass">
            <p class="db-label-caps db-auction-result__eyebrow">Auction Complete</p>
            <h2 class="db-auction-result__title">${winner}</h2>
            <p class="db-auction-result__scores">
              Your squad OVR <strong>${youRating}</strong>
              <span aria-hidden="true">·</span>
              Bot ${botRating}
            </p>
            <div class="db-auction-result__squad">
              ${room.rosters[0]!.map((id) => squadDataCardHtml(poolMap.get(id)!)).join("")}
            </div>
            ${identityPickerHtml("balanced")}
            <div class="db-auction-result__actions">
              <button type="button" class="db-btn-pitch" id="simulate">Simulate Season</button>
              <button type="button" class="btn btn--ghost" id="again">Auction again</button>
              <button type="button" class="btn btn--ghost" id="hub">Hub</button>
            </div>
          </div>
        </div>`;
      const getIdentity = bindIdentityPicker(root);
      root.querySelector("#simulate")?.addEventListener("click", () => {
        const ids = room.rosters[0]!;
        const cards = ids.map((id) => poolMap.get(id)!).filter(Boolean);
        saveSquadForSeason(mode, ids, cards, youRating, "auction", {
          tacticalIdentity: getIdentity(),
          formationId: mode.formationId,
        });
        navigate("draftballer", "season");
      });
      root.querySelector("#again")?.addEventListener("click", () => renderDraftballerAuction(root, navigate));
      root.querySelector("#hub")?.addEventListener("click", () => navigate("draftballer"));
      bindPageMotion();
      return;
    }

    const lot = room.auctionLot;
    syncLotBidLog(lot);
    const nomIdx = nominatorIndex(room);
    const isYourNomination = nomIdx === 0 && (!lot || lot.status !== "open");
    const maxBid = maxAffordableBid(room, 0);
    const budget = room.budgets?.[0] ?? 0;
    const lotNum = room.picks.length + 1;
    const nominatedCard = lot?.status === "open" ? poolMap.get(lot.playerId) : undefined;
    const minBid = lot && lot.status === "open" ? (lot.highBidder === null ? 1 : lot.highBid + 1) : 1;
    const defaultBid = lot && lot.status === "open" ? Math.min(maxBid, minBid) : minBid;
    const canBid = lot?.status === "open" && maxBid >= minBid;

    root.innerHTML = `
      <div class="shell db-root db-auction-page" data-ui="${UI_BUILD}">
        ${auctionTopBar(budget, lotNum)}
        <main class="db-auction-main">
          <section class="db-auction-col db-auction-col--left">
            ${
              lot && lot.status === "open" && nominatedCard
                ? `
              <div class="db-auction-stage db-glass">
                <div class="db-auction-live-badge db-soft-pulse">
                  <span class="db-auction-live-badge__dot" aria-hidden="true"></span>
                  <span class="db-label-caps">LIVE AUCTION</span>
                </div>
                <div class="db-auction-timer-wrap">
                  <span class="db-label-caps">CLOSING IN</span>
                  <div class="db-auction-timer" id="db-auction-timer">00:14.22</div>
                </div>
                ${showcaseCardHtml(nominatedCard)}
              </div>
              <div class="db-auction-activity db-glass">
                <h3 class="db-label-caps db-auction-activity__title">RECENT ACTIVITY</h3>
                <div class="db-auction-activity__feed">${bidActivityHtml(lot, bidLog)}</div>
              </div>`
                : `
              <div class="db-auction-nominate db-glass">
                <p class="db-label-caps db-auction-nominate__eyebrow">${mode.title ?? mode.id}</p>
                ${
                  isYourNomination
                    ? `<h2 class="db-auction-nominate__title">Nominate a player</h2>
                       <p class="db-auction-nominate__hint">Select from the pool to open the lot.</p>`
                    : `${keepieLoaderHtml({ size: 64, label: "Nominating", className: "db-keepie--inline" })}
                       <p class="db-auction-nominate__hint">Stand by for the next showcase.</p>`
                }
              </div>`
            }
            ${
              isYourNomination || (!lot && nomIdx === 1)
                ? `
              <div class="db-auction-pool">
                <h3 class="db-label-caps">AVAILABLE POOL</h3>
                <div class="db-auction-pool__grid">
                  ${room.poolIds
                    .slice(0, 48)
                    .map((id) => poolMap.get(id)!)
                    .filter(Boolean)
                    .map((c) => nomPoolCardHtml(c))
                    .join("")}
                </div>
              </div>`
                : ""
            }
            ${statusMsg ? `<p class="db-auction-error">${escapeHtml(statusMsg)}</p>` : ""}
          </section>

          <aside class="db-auction-col db-auction-col--right">
            ${
              lot && lot.status === "open"
                ? `
              <div class="db-auction-bid-panel db-glass">
                <div class="db-auction-bid-panel__high">
                  <div class="db-auction-bid-panel__high-head">
                    <span class="db-label-caps">CURRENT HIGHEST</span>
                    ${lot.highBidder !== null ? `<span class="db-auction-reserve">RESERVE MET</span>` : ""}
                  </div>
                  <div class="db-auction-bid-panel__high-val">${formatBudget(lot.highBid)}</div>
                  ${lot.highBidder !== null ? `<p class="db-auction-bid-panel__leader">${DRAFTER_NAMES[lot.highBidder]}</p>` : ""}
                </div>
                <div class="db-auction-bid-panel__controls">
                  <div class="db-auction-bid-panel__slider-head">
                    <label class="db-label-caps" for="bid-slider">YOUR BID AMOUNT</label>
                    <span class="db-auction-bid-panel__bid-val" id="bid-value">${formatBudget(defaultBid)}</span>
                  </div>
                  <input type="range" id="bid-slider" class="db-auction-slider" min="${minBid}" max="${maxBid}" step="1" value="${defaultBid}" ${canBid ? "" : "disabled"} />
                  <input type="hidden" id="bid-amt" value="${defaultBid}" />
                  <div class="db-auction-quick-bids">
                    <button type="button" class="db-auction-quick-bids__btn" data-bid-delta="1" ${canBid ? "" : "disabled"}>+1</button>
                    <button type="button" class="db-auction-quick-bids__btn" data-bid-delta="5" ${canBid ? "" : "disabled"}>+5</button>
                    <button type="button" class="db-auction-quick-bids__btn" data-bid-delta="10" ${canBid ? "" : "disabled"}>+10</button>
                    <button type="button" class="db-auction-quick-bids__btn" data-bid-delta="max" ${canBid ? "" : "disabled"}>MAX</button>
                  </div>
                  <button type="button" class="db-btn-pitch db-auction-place-bid db-bid-pulse db-pitch-glow" id="bid-btn" ${canBid ? "" : "disabled"}>PLACE BID</button>
                  <button type="button" class="db-auction-resolve" id="resolve-btn">Resolve lot</button>
                </div>
                <p class="db-auction-tip">If a bid is placed in the final 10 seconds, the clock resets. All bids are final and deducted immediately.</p>
              </div>
              <div class="db-auction-tactical db-glass">
                <h3 class="db-label-caps">TACTICAL FIT</h3>
                <div class="db-auction-tactical__bars">${tacticalFitBars(nominatedCard)}</div>
              </div>`
                : `
              <div class="db-auction-sidebar-idle db-glass">
                <h3 class="db-label-caps">YOUR XI</h3>
                <div class="db-auction-xi">
                  ${
                    room.rosters[0]!.length
                      ? room.rosters[0]!.map((id) => {
                          const c = poolMap.get(id)!;
                          return `<div class="db-auction-xi__row"><span>${escapeHtml(c.name)}</span><strong>${c.ovr}</strong></div>`;
                        }).join("")
                      : `<p class="db-auction-xi__empty">No picks yet</p>`
                  }
                </div>
                <div class="db-auction-drafters">
                  ${DRAFTER_NAMES.map((n, i) => {
                    const b = room.budgets?.[i] ?? 0;
                    return `<div class="db-auction-drafters__row"><span>${n}</span><span>${room.rosters[i]!.length}/11 · ${formatBudget(b)}</span></div>`;
                  }).join("")}
                </div>
              </div>`
            }
          </aside>
        </main>
      </div>`;

    root.querySelector("#back")?.addEventListener("click", () => {
      clearTimer();
      navigate("draftballer");
    });

    if (lot && lot.status === "open") {
      startTimer();
      bindBidControls(lot);
    } else {
      clearTimer();
    }

    if (isYourNomination) {
      root.querySelectorAll(".db-auction-nom-card").forEach((el) => {
        el.addEventListener("click", () => {
          const id = (el as HTMLElement).dataset.id!;
          const card = poolMap.get(id);
          if (!card) return;
          try {
            room = openAuctionLot(room, card, 0);
            syncLotBidLog(room.auctionLot);
            room = runBotBids(room, pushBid);
            statusMsg = "";
            draw();
          } catch (e) {
            statusMsg = e instanceof Error ? e.message : "Cannot nominate";
            draw();
          }
        });
      });
      bindPageMotion();
      return;
    }

    if (nomIdx === 1 && (!lot || lot.status !== "open")) {
      setTimeout(() => {
        botTurn();
        draw();
      }, 600);
    }

    bindPageMotion();
  }

  draw();
}
