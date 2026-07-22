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
import { bindIdentityPicker, identityPickerHtml } from "./draftballer-identity.js";
import { mountStagedReveal } from "../lib/staged-reveal.js";
import { bindEliteMotion } from "../lib/elite-motion.js";
import { keepieLoaderHtml } from "../lib/keepie-loader.js";

/** elite-anim-v1 — Stitch blind_draft_pro_animated motion */
const UI_BUILD = "elite-anim-v1";

type Navigate = (route: string, param?: string) => void;

const DRAFTER_NAMES = ["You", "Rival Bot"];

const PHASE_POSITIONS = [
  "Goalkeeper",
  "Defender",
  "Full-Back",
  "Midfielder",
  "Attacking Mid",
  "Winger",
  "Striker",
];

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function phaseHeader(round: number): { phase: string; title: string } {
  const label = PHASE_POSITIONS[(round - 1) % PHASE_POSITIONS.length] ?? "Player";
  return {
    phase: `Phase ${String(round).padStart(2, "0")}: ${label} Selection`,
    title: `Choose your ${label}`,
  };
}

function fameTierLabel(card: RatedPlayerCard): string {
  if (card.ovr >= 90) return "ICONIC";
  if (card.ovr >= 86) return "LEGENDARY";
  if (card.ovr >= 80) return "RARE";
  const map: Record<string, string> = {
    icon: "ICONIC",
    star: "LEGENDARY",
    known: "RARE",
    cult: "UNCOMMON",
    obscure: "COMMON",
  };
  return map[card.fameTier] ?? "COMMON";
}

function tierClass(card: RatedPlayerCard): string {
  if (card.ovr >= 90) return "db-blind-tier--iconic";
  if (card.ovr >= 86) return "db-blind-tier--legendary";
  if (card.ovr >= 80) return "db-blind-tier--rare";
  return "db-blind-tier--common";
}

function keyStatsHtml(card: RatedPlayerCard): string {
  const a = card.attributes;
  const keys =
    card.position === "GK"
      ? [
          { k: "REF", v: a.def },
          { k: "PAS", v: a.pas },
          { k: "PHY", v: a.phy },
        ]
      : [
          { k: "PAS", v: a.pas },
          { k: "DRI", v: a.dri },
          { k: "SHO", v: a.sho },
        ];
  return keys
    .map(
      (s) => `
      <div class="db-blind-stat">
        <span class="db-label-caps">${s.k}</span>
        <span>${s.v}</span>
      </div>`,
    )
    .join("");
}

function mysteryCardHtml(card: RatedPlayerCard, index: number): string {
  const techId = `DFB-${String(1000 + index * 137).slice(-4)}`;
  return `
    <div class="db-blind-mystery" data-id="${card.playerId}">
      <div class="db-blind-mystery__inner">
        <div class="db-blind-mystery__back">
          <div class="db-blind-mystery__sheen" aria-hidden="true"></div>
          <div class="db-blind-mystery__icon" aria-hidden="true">?</div>
          <div class="db-blind-mystery__back-label">
            <span class="db-label-caps">MYSTERY ASSET</span>
            <span class="db-blind-mystery__q">????</span>
          </div>
          <span class="db-blind-mystery__tech">TECH-ID: ${techId}</span>
        </div>
        <div class="db-blind-mystery__front db-glass ${tierClass(card)}">
          <div class="db-blind-mystery__front-top">
            <span class="db-blind-mystery__ovr">${card.ovr}</span>
            <div class="db-blind-mystery__front-data">
              <span class="db-label-caps db-blind-mystery__rarity">${fameTierLabel(card)} · ${card.position}</span>
              <h3 class="db-blind-mystery__name">${escapeHtml(card.name)}</h3>
              <div class="db-blind-mystery__stats">${keyStatsHtml(card)}</div>
            </div>
          </div>
          <footer class="db-blind-mystery__front-foot">
            <span>${escapeHtml(card.nationality)}</span>
            <span>${escapeHtml(card.contextLine ?? "")}</span>
          </footer>
        </div>
      </div>
    </div>`;
}

function rewardProbabilities(candidates: RatedPlayerCard[]): {
  iconic: number;
  legendary: number;
  rare: number;
} {
  if (candidates.length === 0) return { iconic: 0, legendary: 0, rare: 100 };
  let iconic = 0;
  let legendary = 0;
  let rare = 0;
  for (const c of candidates) {
    if (c.ovr >= 90) iconic += 1;
    else if (c.ovr >= 86) legendary += 1;
    else if (c.ovr >= 80) rare += 1;
    else rare += 1;
  }
  const total = candidates.length;
  return {
    iconic: Math.round((iconic / total) * 100),
    legendary: Math.round((legendary / total) * 100),
    rare: Math.round((rare / total) * 100),
  };
}

function probBarHtml(candidates: RatedPlayerCard[]): string {
  const p = rewardProbabilities(candidates);
  const norm = p.iconic + p.legendary + p.rare || 1;
  const iW = (p.iconic / norm) * 100;
  const lW = (p.legendary / norm) * 100;
  const rW = (p.rare / norm) * 100;
  return `
    <div class="db-blind-prob db-glass">
      <h4 class="db-label-caps db-blind-prob__title">CURRENT REWARD PROBABILITIES</h4>
      <div class="db-blind-prob__bar">
        <div class="db-blind-prob__seg db-blind-prob__seg--iconic" style="width:${iW}%"></div>
        <div class="db-blind-prob__seg db-blind-prob__seg--legendary" style="width:${lW}%"></div>
        <div class="db-blind-prob__seg db-blind-prob__seg--rare" style="width:${rW}%"></div>
      </div>
      <div class="db-blind-prob__labels">
        <div><span class="db-blind-prob__pct">${p.iconic}%</span><span class="db-label-caps">ICONIC (90+)</span></div>
        <div><span class="db-blind-prob__pct">${p.legendary}%</span><span class="db-label-caps">LEGENDARY (86+)</span></div>
        <div><span class="db-blind-prob__pct">${p.rare}%</span><span class="db-label-caps">RARE (80+)</span></div>
      </div>
    </div>`;
}

function botPanelHtml(botSubmitted: boolean, poolQuality: number): string {
  return `
    <div class="db-blind-bot db-glass">
      <div class="db-blind-bot__left">
        <div class="db-blind-bot__avatar" aria-hidden="true">🤖</div>
        <div>
          <h5 class="db-label-caps">BOT OPPONENT: ARCHITECT-V3</h5>
          <p class="db-blind-bot__meta">
            <span class="db-blind-bot__pulse" aria-hidden="true"></span>
            Predicted Draft Quality: ${poolQuality.toFixed(1)}%
          </p>
        </div>
      </div>
      <div class="db-blind-bot__right">
        <span class="db-blind-bot__scan db-soft-pulse${botSubmitted ? " db-blind-bot__scan--done" : ""}">${botSubmitted ? "PICK LOCKED" : "SCANNING ASSETS"}</span>
        <span class="db-blind-bot__core">ARCHITECT-CORE-ACTIVE</span>
      </div>
    </div>`;
}

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

  function bindPageMotion() {
    const pageRoot = root.querySelector(".db-root") as HTMLElement | null;
    if (pageRoot) bindEliteMotion(pageRoot, { scan: "line" });
  }

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

  function visibleCandidates(): RatedPlayerCard[] {
    const taken = new Set(room.blindRound?.submissions.map((s) => s.playerId) ?? []);
    return room.poolIds
      .filter((id) => !taken.has(id))
      .slice(0, 6)
      .map((id) => poolMap.get(id)!)
      .filter(Boolean);
  }

  function avgOvrQuality(cards: RatedPlayerCard[]): number {
    if (cards.length === 0) return 0;
    const avg = cards.reduce((s, c) => s + c.ovr, 0) / cards.length;
    return Math.min(99, (avg / 99) * 100);
  }

  function bindMysteryPick() {
    root.querySelectorAll(".db-blind-mystery").forEach((el) => {
      el.addEventListener("click", () => {
        const id = (el as HTMLElement).dataset.id!;
        const card = poolMap.get(id);
        if (!card) return;
        el.classList.add("db-blind-mystery--flipped");
        setTimeout(() => {
          const result = submitBlindPick(room, 0, card);
          if (result.error) {
            statusMsg = result.error;
            el.classList.remove("db-blind-mystery--flipped");
            draw();
            return;
          }
          statusMsg = "";
          room = result.room;
          const botSubmitted = room.blindRound?.submissions.some((s) => s.drafterIndex === 1) ?? false;
          if (!botSubmitted) botSubmit();
          maybeResolve();
          draw();
        }, 450);
      });
    });
  }

  function draw() {
    if (room.status === "complete") {
      const youRating = squadRating(room.rosters[0]!, poolMap);
      const botRating = squadRating(room.rosters[1]!, poolMap);
      const winner = youRating >= botRating ? "You win the blind draft!" : "Bot wins the blind draft!";
      const yourCards = room.rosters[0]!.map((id) => poolMap.get(id)!).filter(Boolean);
      root.innerHTML = `
        <div class="shell db-root db-blind-page">
          <div class="db-blind-result db-glass">
            <p class="db-label-caps db-blind-result__eyebrow">Blind Draft Complete</p>
            <h2 class="db-blind-result__title">${winner}</h2>
            <p class="db-blind-result__scores">
              Your squad OVR <strong>${youRating}</strong>
              <span aria-hidden="true">·</span>
              Bot ${botRating}
            </p>
            <p class="db-blind-result__hint">Revealing your XI — highest OVR last</p>
            <div id="blind-reveal" class="db-blind-reveal"></div>
            ${identityPickerHtml("balanced")}
            <div class="db-blind-result__actions">
              <button type="button" class="db-btn-pitch" id="simulate">Simulate Season</button>
              <button type="button" class="btn btn--ghost" id="again">Blind draft again</button>
              <button type="button" class="btn btn--ghost" id="hub">Hub</button>
            </div>
          </div>
        </div>`;
      const revealEl = root.querySelector("#blind-reveal") as HTMLElement | null;
      if (revealEl) mountStagedReveal(revealEl, yourCards);
      const getIdentity = bindIdentityPicker(root);
      root.querySelector("#simulate")?.addEventListener("click", () => {
        const ids = room.rosters[0]!;
        const cards = ids.map((id) => poolMap.get(id)!).filter(Boolean);
        saveSquadForSeason(mode, ids, cards, youRating, "blind", {
          tacticalIdentity: getIdentity(),
          formationId: mode.formationId,
        });
        navigate("draftballer", "season");
      });
      root.querySelector("#again")?.addEventListener("click", () => renderDraftballerBlind(root, navigate));
      root.querySelector("#hub")?.addEventListener("click", () => navigate("draftballer"));
      bindPageMotion();
      return;
    }

    const round = room.blindRound;
    const roundNum = round?.round ?? 1;
    const youSubmitted = round?.submissions.some((s) => s.drafterIndex === 0) ?? false;
    const botSubmitted = round?.submissions.some((s) => s.drafterIndex === 1) ?? false;
    const ready = blindRoundReady(room);
    const header = phaseHeader(roundNum);
    const candidates = visibleCandidates();
    const poolQuality = avgOvrQuality(candidates);

    root.innerHTML = `
      <div class="shell db-root db-blind-page" data-ui="${UI_BUILD}">
        <header class="db-blind-topbar">
          <div class="db-blind-topbar__brand">
            <div class="db-blind-topbar__badge" aria-hidden="true">XP</div>
            <span class="db-blind-topbar__title">DRAFTBALLER</span>
          </div>
          <button type="button" class="db-blind-topbar__exit" id="back">Exit</button>
        </header>

        <main class="db-blind-main">
          <div class="db-blind-header">
            <p class="db-label-caps db-blind-header__phase">${header.phase}</p>
            <h1 class="db-blind-header__title">${header.title}</h1>
            <p class="db-blind-header__sub">Round ${roundNum} · ${mode.title ?? mode.id} · ${DRAFTER_NAMES[0]} ${room.rosters[0]!.length}/11</p>
          </div>

          ${
            ready
              ? `<div class="db-blind-status db-glass">${keepieLoaderHtml({ size: 48, label: "Revealing", className: "db-keepie--inline" })}</div>`
              : youSubmitted
                ? `<div class="db-blind-status db-glass">${keepieLoaderHtml({ size: 48, label: "Waiting", className: "db-keepie--inline" })}</div>`
                : `<p class="db-blind-pick-hint">Select one mystery card to reveal your next tactical asset.</p>`
          }

          ${statusMsg ? `<p class="db-blind-error">${escapeHtml(statusMsg)}</p>` : ""}

          ${
            !youSubmitted && !ready
              ? `
            <div class="db-blind-grid">
              ${candidates.map((c, i) => mysteryCardHtml(c, i)).join("")}
            </div>
            ${probBarHtml(candidates)}
            ${botPanelHtml(botSubmitted, poolQuality)}`
              : botPanelHtml(botSubmitted, poolQuality)
          }
        </main>
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
      bindPageMotion();
      return;
    }

    if (!youSubmitted) {
      bindMysteryPick();
      bindPageMotion();
      return;
    }

    if (!botSubmitted) {
      setTimeout(() => {
        botSubmit();
        maybeResolve();
        draw();
      }, 600);
    }

    bindPageMotion();
  }

  draw();
}
