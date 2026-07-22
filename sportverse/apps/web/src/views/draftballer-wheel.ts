import type { DraftModeConfig, RatedPlayerCard, WheelBuildState } from "@sportverse/draftballer-types";
import {
  buildDraftPool,
  createWheelSession,
  draftPickAllowedForSlot,
  ensureSegmentsForSlot,
  evaluateSquadQuality,
  getFullSquadPickBoard,
  getPresetMode,
  listWheelFormationIds,
  moveFormationPlayer,
  pickPlayerForSlot,
  randomSegmentIndex,
  selectFormationSlot,
  spinToPlayableSegment,
  dailyChallengeSeed,
  randomSessionSeed,
  saveSquadForSeason,
  useReroll,
  type SquadPickBoardEntry,
} from "@sportverse/draftballer-core";

/** Bust stale PWA caches — bump when wheel UX changes. */
const WHEEL_UI_BUILD = "fresh-seed-v1";

/** Casual drafts must not reuse yesterday's / last draft's seed (same clubs). */
function resolveWheelSeed(mode: DraftModeConfig, challengeSeed?: string): string {
  if (challengeSeed?.trim()) return challengeSeed.trim();
  if (mode.id.startsWith("daily-")) {
    // mode.id = daily-YYYY-MM-DD → shared wheel for everyone that day
    const day = mode.id.slice("daily-".length);
    if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      return dailyChallengeSeed(new Date(`${day}T12:00:00Z`));
    }
    return dailyChallengeSeed();
  }
  return randomSessionSeed();
}
import { getFormation } from "@sportverse/match-sim";
import { computeSquadRating } from "@sportverse/rating-engine";
import { playerCardHtml } from "./draftballer-hub.js";
import { bindPlayerCardBreakdownsWithPool } from "./draftballer-breakdown.js";
import { submitDailyScore } from "./draftballer-daily.js";
import { playDraftSound } from "../lib/draft-sound.js";
import { mountStagedReveal } from "../lib/staged-reveal.js";
import { bindIdentityPicker, identityPickerHtml } from "./draftballer-identity.js";
import { pitchSurfaceHtml } from "./draftballer-pitch.js";
import { bindEliteMotion, triggerWheelSnap } from "../lib/elite-motion.js";
import { keepieLoaderHtml } from "../lib/keepie-loader.js";

type Navigate = (route: string, param?: string) => void;

const SPIN_MS = 5000;
/** UNCALIBRATED — EXPERT PRIOR: fameSum above this gets a gold flash on land. */
const ICON_FAME_SUM_FLASH = 1600;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Variable-tension ticks: interval grows as the wheel slows (ease-out). */
function scheduleSpinTicks(durationMs: number, onTick: () => void): () => void {
  const start = performance.now();
  let cancelled = false;
  let nextAt = 0;
  const step = (now: number) => {
    if (cancelled) return;
    const t = Math.min(1, (now - start) / durationMs);
    if (now >= start + nextAt) {
      onTick();
      nextAt += 55 + t * t * 165;
    }
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  return () => {
    cancelled = true;
  };
}

function shortClubLabel(label: string): string {
  const parts = label.trim().split(/\s+/);
  if (parts.length <= 2) return label;
  return parts.slice(0, 2).join(" ");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function pickBoardSectionHtml(
  state: WheelBuildState,
  pickBoard: SquadPickBoardEntry[],
  segment: NonNullable<WheelBuildState["spunSegment"]>,
  selectedPickId: string | null,
  _blind: boolean,
  squadQuality: ReturnType<typeof evaluateSquadQuality>,
): string {
  const round = state.roster.length + 1;
  const eligible = pickBoard.filter((e) => e.eligible);
  const selectedEntry =
    (selectedPickId && pickBoard.find((e) => e.card.playerId === selectedPickId)) ||
    eligible[0] ||
    null;
  const selectedName = selectedEntry?.card.name ?? "Select a player";

  return `
    <section class="db-select-board">
      <header class="db-select-board__head">
        <div class="db-select-board__chip db-soft-pulse">
          <span class="db-select-board__pulse" aria-hidden="true"></span>
          <span class="db-select-board__round">Round ${String(round).padStart(2, "0")} · Full squad</span>
        </div>
        <h2 class="db-select-board__title">${escapeHtml(segment.label)} — pick any available player</h2>
        <p class="db-select-board__lede">Tap a card to draft. Greyed cards only fit positions already filled.</p>
        ${
          eligible.length
            ? `<button class="btn btn--ghost db-select-random" id="random-pick" type="button">Random pick</button>`
            : state.rerollsLeft > 0
              ? `<button class="btn btn--ghost" id="respin-empty" type="button">Respin (${state.rerollsLeft} left)</button>`
              : `<p class="db-select-board__warn">No placeable players left — respin</p>`
        }
      </header>
      ${
        squadQuality.filled > 0
          ? `<p class="db-squad-quality db-squad-quality--${squadQuality.band}">
              Squad avg <strong>${squadQuality.avgOvr}</strong>
              · ${eligible.length} selectable
              · ${squadQuality.picksRemaining} left
            </p>`
          : ""
      }
      <div class="db-select-board__grid" id="pick-pool">
        ${pickBoard
          .map((entry) => {
            const selected = selectedPickId === entry.card.playerId;
            const face = playerCardHtml(entry.card, true, {
              ineligible: !entry.eligible,
              recommended: entry.recommended,
            });
            return `<button type="button" class="db-pick-card ${selected ? "db-pick-card--active" : ""} ${
              entry.eligible ? "" : "db-pick-card--disabled"
            }" data-pick-id="${entry.card.playerId}" ${entry.eligible ? "" : "disabled"} aria-label="${escapeHtml(
              entry.card.name,
            )}">${face}</button>`;
          })
          .join("")}
      </div>
      <footer class="db-select-board__footer">
        <div>
          <span class="db-label-caps">Selection</span>
          <strong class="db-select-board__name">${escapeHtml(selectedName)}</strong>
        </div>
        <button class="db-btn-pitch db-select-confirm" id="confirm-pick" type="button" ${
          !selectedEntry?.eligible ? "disabled" : ""
        }>
          Confirm Pick →
        </button>
      </footer>
    </section>`;
}

function wheelSegmentHtml(
  segments: WheelBuildState["segments"],
  activeIndex: number | null,
  rotationDeg: number,
): string {
  const n = Math.max(1, segments.length);
  const slice = 360 / n;
  const colors = ["#182218", "#141e14", "#222d22", "#0f1810"];

  const gradientStops = segments
    .map((seg, i) => {
      const c = colors[i % colors.length];
      return `${c} ${i * slice}deg ${(i + 1) * slice}deg`;
    })
    .join(", ");

  const labels = segments
    .map((seg, i) => {
      const angle = i * slice + slice / 2;
      const rad = ((angle - 90) * Math.PI) / 180;
      const r = 38;
      const x = 50 + r * Math.cos(rad);
      const y = 50 + r * Math.sin(rad);
      const highlight = activeIndex === i ? " db-wheel-label--active" : "";
      return `<span class="db-wheel-label${highlight}" style="--a:${angle}deg;left:${x}%;top:${y}%">${shortClubLabel(seg.label)}</span>`;
    })
    .join("");

  return `
    <div class="db-wheel-wrap">
      <div class="db-wheel-pointer" aria-hidden="true"></div>
      <div class="db-wheel" id="wheel" style="background:conic-gradient(from -90deg, ${gradientStops});transform:rotate(${rotationDeg}deg)">
        ${labels}
      </div>
      <div class="db-wheel-hub">SPIN</div>
    </div>`;
}

/** Interactive pitch — formation coords from match-sim, overlays drafted players. */
function pitchHtml(
  state: WheelBuildState,
  poolMap: Map<string, RatedPlayerCard>,
  opts: { swapHint?: boolean; swapFrom?: number | null } = {},
): string {
  const formationId = state.mode.formationId ?? "4-3-3";
  const form = getFormation(formationId);
  const activeIdx = state.selectedSlotIndex ?? -1;
  const movingPlayer =
    opts.swapFrom != null && state.formation[opts.swapFrom]?.playerId
      ? poolMap.get(state.formation[opts.swapFrom]!.playerId!)
      : null;

  const dots = state.formation
    .map((slot, i) => {
      const coord = form.slots[i] ?? form.slots[0]!;
      const filled = slot.playerId ? poolMap.get(slot.playerId) : null;
      const active = i === activeIdx && state.phase !== "complete";
      const swapSel = opts.swapFrom === i;
      const legalMoveTarget =
        !!movingPlayer &&
        !slot.playerId &&
        draftPickAllowedForSlot(movingPlayer, slot.position, true);
      const last = filled ? filled.name.split(" ").pop() : "—";
      const classes = [
        "db-wheel-pitch__slot",
        filled ? "db-wheel-pitch__slot--filled" : "",
        active ? "db-wheel-pitch__slot--active" : "",
        swapSel ? "db-wheel-pitch__slot--swap" : "",
        legalMoveTarget ? "db-wheel-pitch__slot--legal" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `
        <button type="button" class="${classes}" data-slot="${i}"
          style="left:${coord.y}%;top:${100 - coord.x}%"
          title="${slot.position}${filled ? ` · ${filled.name}` : legalMoveTarget ? " · drop here" : " · empty"}">
          <span class="db-wheel-pitch__pos">${slot.position}</span>
          <span class="db-wheel-pitch__name">${last}</span>
        </button>`;
    })
    .join("");

  const hint = movingPlayer
    ? `Moving ${movingPlayer.name.split(" ").pop()} — tap a highlighted slot they can play (frees their old spot)`
    : state.phase === "picking"
      ? "Pick a card below · or tap a filled player, then a legal empty slot to reposition them"
      : opts.swapHint
        ? "Tap a filled player, then a legal empty slot to move — or another filled player to swap"
        : "Spin for a club, then pick any available player from the full squad";

  return `
    ${pitchSurfaceHtml(dots, { className: "db-wheel-pitch", ariaLabel: `${formationId} pitch` })}
    <p class="db-wheel-pitch__hint">${hint}</p>`;
}

function bindPitchInteractions(
  root: HTMLElement,
  getState: () => WheelBuildState,
  setState: (s: WheelBuildState) => void,
  pool: RatedPlayerCard[],
  redraw: () => void,
  swapFromRef: { current: number | null },
) {
  root.querySelectorAll<HTMLElement>(".db-wheel-pitch__slot").forEach((el) => {
    el.addEventListener("click", () => {
      const idx = Number(el.dataset.slot);
      if (!Number.isFinite(idx)) return;
      const state = getState();
      const slot = state.formation[idx];
      if (!slot) return;

      // Empty slot: complete a move if a filled player is selected, else mark target.
      if (!slot.playerId) {
        if (swapFromRef.current != null) {
          try {
            setState(moveFormationPlayer(state, swapFromRef.current, idx, pool));
            playDraftSound("land");
          } catch {
            playDraftSound("tick");
          }
          swapFromRef.current = null;
          redraw();
          return;
        }
        setState(selectFormationSlot(state, idx));
        redraw();
        return;
      }

      // Filled: start move/swap, cancel, or complete swap with another filled slot.
      if (swapFromRef.current == null) {
        swapFromRef.current = idx;
        redraw();
        return;
      }

      if (swapFromRef.current === idx) {
        swapFromRef.current = null;
        redraw();
        return;
      }

      try {
        setState(moveFormationPlayer(state, swapFromRef.current, idx, pool));
        playDraftSound("land");
      } catch {
        playDraftSound("tick");
      }
      swapFromRef.current = null;
      redraw();
    });
  });
}

export function renderDraftballerWheel(root: HTMLElement, navigate: Navigate, challengeSeed?: string) {
  const raw = sessionStorage.getItem("db_mode");
  const mode: DraftModeConfig = raw ? JSON.parse(raw) : getPresetMode("all-time-any");
  const seed = resolveWheelSeed(mode, challengeSeed);
  sessionStorage.setItem("db_wheel_seed", seed);
  const pool = buildDraftPool(mode);
  const poolMap = new Map(pool.map((c) => [c.playerId, c]));
  const blind = mode.blindRatings ?? mode.difficulty === "hard";
  bindPlayerCardBreakdownsWithPool(root, pool);
  let state = createWheelSession(mode, pool, seed);
  let spinTargetIndex = 0;
  let lastLandedIndex: number | undefined;
  let wheelRotation = 0;
  let spinning = false;
  let selectedPickId: string | null = null;
  const swapFromRef: { current: number | null } = { current: null };

  function bindPageMotion() {
    const pageRoot = root.querySelector(".db-root") as HTMLElement | null;
    if (pageRoot) bindEliteMotion(pageRoot, { scan: "line" });
  }

  function draw() {
    if (state.phase === "complete") {
      const players = state.roster.map((id) => poolMap.get(id)!).filter(Boolean);
      const formationId = state.mode.formationId ?? "4-3-3";
      const squadBreakdown = computeSquadRating(players, { formationId });
      const rating = squadBreakdown.squadRating;
      root.innerHTML = `
        <div class="shell db-root">
          <div class="db-wheel-result">
            <p class="db-hero__label">Squad Complete</p>
            <h2 class="db-hero__title" style="font-size:2.2rem">YOUR XI</h2>
            <p style="color:var(--db-muted)">Squad Rating <strong style="color:var(--db-gold);font-size:1.4rem">${rating}</strong> · ${formationId} · Seed: ${state.seed.slice(0, 12)}…</p>
            ${pitchHtml(state, poolMap, { swapHint: true, swapFrom: swapFromRef.current })}
            ${
              blind
                ? `<p class="db-reveal-hint">Blind reveal — highest OVR last</p><div id="wheel-reveal" style="margin:16px 0"></div>`
                : `<div class="db-pool-grid" style="margin:16px 0">
              ${state.roster.map((id) => playerCardHtml(poolMap.get(id)!, true)).join("")}
            </div>`
            }
            ${identityPickerHtml("balanced")}
            <button class="btn db-btn-pitch" id="simulate">Simulate Season</button>
            <button class="btn btn--ghost" id="again">Spin again</button>
            <button class="btn btn--ghost" id="hub">DRAFTBALLER Hub</button>
          </div>
        </div>`;
      if (blind) {
        const revealEl = root.querySelector("#wheel-reveal") as HTMLElement | null;
        if (revealEl) mountStagedReveal(revealEl, players);
      }
      bindPitchInteractions(
        root,
        () => state,
        (s) => {
          state = s;
        },
        pool,
        draw,
        swapFromRef,
      );
      const getIdentity = bindIdentityPicker(root);
      root.querySelector("#simulate")?.addEventListener("click", () => {
        saveSquadForSeason(mode, state.roster, pool, rating, "wheel", {
          seed: state.seed,
          formationId,
          tacticalIdentity: getIdentity(),
        });
        if (mode.id.startsWith("daily-")) {
          void submitDailyScore("Guest", rating);
        }
        navigate("draftballer", "season");
      });
      root.querySelector("#again")?.addEventListener("click", () => {
        sessionStorage.removeItem("db_wheel_seed");
        // Daily stays on the shared seed; casual drafts mint a brand-new one.
        renderDraftballerWheel(
          root,
          navigate,
          mode.id.startsWith("daily-") ? seed : undefined,
        );
      });
      root.querySelector("#hub")?.addEventListener("click", () => navigate("draftballer"));
      bindPageMotion();
      return;
    }

    // Rebuild club/year slices for the next pick (not position-filtered).
    if (state.phase === "ready") {
      state = ensureSegmentsForSlot(state, pool);
    }

    const segment = state.spunSegment;
    const pickBoard = segment ? getFullSquadPickBoard(state, pool) : [];
    const eligiblePicks = pickBoard.filter((e) => e.eligible);
    if (state.phase === "picking" && eligiblePicks.length) {
      if (!selectedPickId || !eligiblePicks.some((e) => e.card.playerId === selectedPickId)) {
        selectedPickId = eligiblePicks[0]!.card.playerId;
      }
    } else if (state.phase !== "picking") {
      selectedPickId = null;
    }
    const squadQuality = evaluateSquadQuality(state.roster, poolMap, state.squadSize);

    if (!state.segments.length && state.phase === "ready") {
      root.innerHTML = `
        <div class="shell db-root db-wheel-page">
          <button class="btn btn--ghost" id="back">← Exit</button>
          <header class="db-hero">
            <p class="db-hero__label">${mode.title ?? "Spin & Build"} · Wheel Draft</p>
            <h1 class="db-hero__title" style="font-size:clamp(1.8rem,5vw,2.8rem)">NO CLUBS READY</h1>
            <p style="color:var(--db-muted);max-width:48ch;margin:0 auto">
              No recognizable club-seasons matched this mode’s pool. Try All-Time · Any League, or another era.
            </p>
            <button class="btn btn--ghost" id="hub" style="margin-top:1rem">DRAFTBALLER Hub</button>
          </header>
        </div>`;
      root.querySelector("#back")?.addEventListener("click", () => navigate("draftballer"));
      root.querySelector("#hub")?.addEventListener("click", () => navigate("draftballer"));
      bindPageMotion();
      return;
    }

    const showWheel = state.phase === "ready" || state.phase === "spinning" || state.phase === "picking";

    root.innerHTML = `
      <div class="shell db-root db-wheel-page">
        <button class="btn btn--ghost" id="back">← Exit</button>
        <header class="db-hero" style="padding-bottom:0.75rem;margin-bottom:0.75rem">
          <p class="db-label-caps" data-wheel-ui="${WHEEL_UI_BUILD}">${mode.title ?? "Spin & Build"}</p>
          <h1 class="db-hero__title" style="font-size:clamp(1.9rem,5vw,2.7rem);color:#fff">Spin. Pick. Build.</h1>
          <p style="color:var(--db-muted);font-size:0.92rem;max-width:46ch;margin:0 auto;line-height:1.5">
            Unlock legendary squads from football history with every rotation.
          </p>
          <ol class="db-wheel-steps">
            <li>Spin for a club / year</li>
            <li>Pick anyone from the full squad</li>
            <li>Greyed cards only fit already-filled positions</li>
          </ol>
        </header>

        <div class="db-wheel-layout">
          <div class="db-wheel-col">
            ${
              showWheel
                ? wheelSegmentHtml(
                    state.segments,
                    state.phase === "picking" ? spinTargetIndex : null,
                    wheelRotation,
                  )
                : ""
            }
            ${
              segment
                ? `
              <div class="db-spin-result panel db-glass">
                <p class="db-label-caps">You landed on</p>
                <h3 class="db-spin-result__title">${segment.label}</h3>
                <p class="db-spin-result__era">${segment.sublabel}</p>
              </div>`
                : ""
            }
            ${
              state.phase === "ready"
                ? `<button class="btn db-spin-btn" id="spin" ${spinning ? "disabled" : ""}>Spin the wheel</button>
                   <p class="db-wheel-hint">Rerolls left: ${state.rerollsLeft} · ${state.roster.length}/${state.squadSize} filled${
                     state.roster.length > 0
                       ? ` · Squad avg ${squadQuality.avgOvr || "—"}`
                       : ""
                   }</p>`
                : state.phase === "spinning"
                  ? `<div class="db-keepie-overlay">${keepieLoaderHtml({ size: 64, label: "Spinning" })}</div>`
                  : state.fallback === "respin_free"
                    ? `<p class="db-wheel-hint">This squad has no free players — <strong>respin</strong></p>
                       <button class="btn db-spin-btn" id="respin-empty" type="button">Respin (${state.rerollsLeft} left)</button>`
                    : state.fallback === "out_of_position"
                      ? `<p class="db-wheel-hint">No free players and no rerolls left — try another mode</p>`
                      : ""
            }
          </div>

          <div class="db-wheel-col">
          <div class="panel db-glass" style="width:100%">
            <strong style="color:var(--db-pitch)">Pitch · ${state.mode.formationId ?? "4-3-3"}</strong>
              ${
                state.phase === "ready" && state.roster.length === 0
                  ? `<label class="db-stat-label" style="display:block;margin:8px 0 4px">Shape</label>
                     <select id="formationPick" class="btn btn--ghost btn--block">
                       ${listWheelFormationIds()
                         .map(
                           (id) =>
                             `<option value="${id}" ${id === (state.mode.formationId ?? "4-3-3") ? "selected" : ""}>${id}</option>`,
                         )
                         .join("")}
                     </select>`
                  : ""
              }
              <p style="font-size:0.75rem;color:var(--db-muted);margin:8px 0 10px">
                ${
                  state.phase === "picking"
                    ? `Pick a card — auto-placed into the best open slot · ${eligiblePicks.length} available`
                    : `Spin, then draft from the full club squad`
                }
              </p>
              ${pitchHtml(state, poolMap, { swapHint: state.roster.length > 0, swapFrom: swapFromRef.current })}
            </div>
          </div>
        </div>

        ${
          state.phase === "picking" && segment
            ? pickBoardSectionHtml(state, pickBoard, segment, selectedPickId, blind, squadQuality)
            : ""
        }
      </div>`;

    root.querySelector("#back")?.addEventListener("click", () => navigate("draftballer"));

    bindPitchInteractions(
      root,
      () => state,
      (s) => {
        state = s;
      },
      pool,
      draw,
      swapFromRef,
    );

    root.querySelector("#formationPick")?.addEventListener("change", (e) => {
      if (state.roster.length > 0) return;
      const formationId = (e.target as HTMLSelectElement).value;
      const nextMode = { ...mode, formationId };
      sessionStorage.setItem("db_mode", JSON.stringify(nextMode));
      Object.assign(mode, nextMode);
      state = createWheelSession(nextMode, pool, state.seed);
      swapFromRef.current = null;
      draw();
    });

    const runRespin = () => {
      if (state.rerollsLeft <= 0) return;
      try {
        state = useReroll(state, pool);
        lastLandedIndex = state.segments.findIndex((s) => s.id === state.spunSegment?.id);
        spinTargetIndex = lastLandedIndex >= 0 ? lastLandedIndex : 0;
        draw();
      } catch {
        /* no rerolls */
      }
    };

    root.querySelector("#spin")?.addEventListener("click", () => {
      if (state.phase !== "ready" || spinning) return;
      spinning = true;
      spinTargetIndex = randomSegmentIndex(
        state.segments,
        state.seed,
        state.spinsUsed,
        lastLandedIndex,
      );
      state = { ...state, phase: "spinning" };

      const n = state.segments.length;
      const slice = 360 / n;
      const targetAngle = 360 - (spinTargetIndex * slice + slice / 2);
      const extraSpins = 6 + Math.floor(Math.random() * 4);
      const currentMod = ((wheelRotation % 360) + 360) % 360;
      const delta = (targetAngle - currentMod + 360) % 360;
      const nextRotation = wheelRotation + extraSpins * 360 + delta;

      const spinMs = prefersReducedMotion() ? 200 : SPIN_MS;
      draw();

      const wheelEl = root.querySelector("#wheel") as HTMLElement | null;
      const wrapEl = root.querySelector(".db-wheel-wrap") as HTMLElement | null;
      if (!wheelEl) {
        spinning = false;
        state = spinToPlayableSegment(state, spinTargetIndex, pool);
        lastLandedIndex = state.segments.findIndex((s) => s.id === state.spunSegment?.id);
        draw();
        return;
      }

      // Pin current angle with no transition, then animate on next frames.
      wheelEl.style.transition = "none";
      wheelEl.style.transform = `rotate(${wheelRotation}deg)`;
      void wheelEl.offsetWidth;

      const cancelTicks = prefersReducedMotion()
        ? () => undefined
        : scheduleSpinTicks(spinMs, () => playDraftSound("tick"));

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          wheelRotation = nextRotation;
          wheelEl.style.transition = `transform ${spinMs}ms cubic-bezier(0.22, 1, 0.36, 1)`;
          wheelEl.style.transform = `rotate(${wheelRotation}deg)`;
        });
      });

      window.setTimeout(() => {
        cancelTicks();
        const landed = state.segments[spinTargetIndex];
        if (wheelEl && !prefersReducedMotion()) {
          triggerWheelSnap(wheelEl, wheelRotation);
        }
        state = spinToPlayableSegment({ ...state, phase: "ready" }, spinTargetIndex, pool);
        lastLandedIndex = state.segments.findIndex((s) => s.id === state.spunSegment?.id);
        if (lastLandedIndex < 0) lastLandedIndex = spinTargetIndex;
        spinTargetIndex = lastLandedIndex;
        playDraftSound("land");
        const finalLanded = state.spunSegment ?? landed;
        if (finalLanded && (finalLanded.fameSum ?? 0) >= ICON_FAME_SUM_FLASH) {
          wrapEl?.classList.add("db-wheel-wrap--gold-flash");
          playDraftSound("crowd");
        }
        spinning = false;
        draw();
      }, spinMs + 80);
    });

    root.querySelector("#random-pick")?.addEventListener("click", () => {
      if (state.phase !== "picking" || eligiblePicks.length === 0) return;
      const pick = eligiblePicks[Math.floor(Math.random() * eligiblePicks.length)]!;
      try {
        state = pickPlayerForSlot(state, pick.card.playerId, pool);
        selectedPickId = null;
        swapFromRef.current = null;
        playDraftSound("land");
        draw();
      } catch {
        /* invalid pick */
      }
    });

    root.querySelectorAll("#pick-pool .db-pick-card:not([disabled])").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = (el as HTMLElement).dataset.pickId;
        if (!id || state.phase !== "picking") return;
        try {
          state = pickPlayerForSlot(state, id, pool);
          selectedPickId = null;
          swapFromRef.current = null;
          playDraftSound("land");
          draw();
        } catch {
          selectedPickId = id;
          draw();
        }
      });
    });

    root.querySelector("#confirm-pick")?.addEventListener("click", () => {
      if (!selectedPickId || state.phase !== "picking") return;
      try {
        state = pickPlayerForSlot(state, selectedPickId, pool);
        selectedPickId = null;
        swapFromRef.current = null;
        playDraftSound("land");
        draw();
      } catch {
        /* invalid pick */
      }
    });

    root.querySelectorAll("#respin-empty").forEach((btn) => {
      btn.addEventListener("click", runRespin);
    });

    bindPageMotion();
  }

  draw();
}
