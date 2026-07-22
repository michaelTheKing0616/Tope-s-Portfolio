import type { DraftModeConfig, RatedPlayerCard, WheelBuildState } from "@sportverse/draftballer-types";
import {
  buildDraftPool,
  createWheelSession,
  currentFormationSlot,
  ensureSegmentsForSlot,
  evaluateSquadQuality,
  getFullSquadPickBoard,
  getPresetMode,
  listWheelFormationIds,
  pickPlayerForSlot,
  randomSegmentIndex,
  selectFormationSlot,
  spinToPlayableSegment,
  swapFormationSlots,
  dailyChallengeSeed,
  saveSquadForSeason,
  useReroll,
} from "@sportverse/draftballer-core";

/** Bust stale PWA caches — bump when wheel UX changes. */
const WHEEL_UI_BUILD = "full-squad-v1";
import { getFormation } from "@sportverse/match-sim";
import { computeSquadRating } from "@sportverse/rating-engine";
import { playerCardHtml } from "./draftballer-hub.js";
import { bindPlayerCardBreakdownsWithPool } from "./draftballer-breakdown.js";
import { submitDailyScore } from "./draftballer-daily.js";
import { playDraftSound } from "../lib/draft-sound.js";
import { mountStagedReveal } from "../lib/staged-reveal.js";
import { bindIdentityPicker, identityPickerHtml } from "./draftballer-identity.js";
import { pitchSurfaceHtml } from "./draftballer-pitch.js";

type Navigate = (route: string, param?: string) => void;

const SPIN_MS = 4200;
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

function wheelSegmentHtml(
  segments: WheelBuildState["segments"],
  activeIndex: number | null,
  rotationDeg: number,
): string {
  const n = Math.max(1, segments.length);
  const slice = 360 / n;
  const colors = ["#e8f1ff", "#f4f5f7", "#dcebff", "#eef0f3"];

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
  const activeIdx =
    state.mode.draftOrder === "position_first" && state.selectedSlotIndex != null
      ? state.selectedSlotIndex
      : state.currentSlotIndex;

  const dots = state.formation
    .map((slot, i) => {
      const coord = form.slots[i] ?? form.slots[0]!;
      const filled = slot.playerId ? poolMap.get(slot.playerId) : null;
      const active = i === activeIdx && state.phase !== "complete";
      const swapSel = opts.swapFrom === i;
      const last = filled ? filled.name.split(" ").pop() : "—";
      const classes = [
        "db-wheel-pitch__slot",
        filled ? "db-wheel-pitch__slot--filled" : "",
        active ? "db-wheel-pitch__slot--active" : "",
        swapSel ? "db-wheel-pitch__slot--swap" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `
        <button type="button" class="${classes}" data-slot="${i}"
          style="left:${coord.y}%;top:${100 - coord.x}%"
          title="${slot.position}${filled ? ` · ${filled.name}` : " · empty"}">
          <span class="db-wheel-pitch__pos">${slot.position}</span>
          <span class="db-wheel-pitch__name">${last}</span>
        </button>`;
    })
    .join("");

  return `
    ${pitchSurfaceHtml(dots, { className: "db-wheel-pitch", ariaLabel: `${formationId} pitch` })}
    <p class="db-wheel-pitch__hint">
      ${
        opts.swapHint
          ? "Tap a filled player, then another legal slot to swap · empty slot sets next pick"
          : "Tap a slot to set the next pick position"
      }
    </p>`;
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

      // Empty slot → target for next spin/pick
      if (!slot.playerId) {
        swapFromRef.current = null;
        setState(selectFormationSlot(state, idx));
        redraw();
        return;
      }

      // Filled: start or complete a legal swap
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
        setState(swapFormationSlots(state, swapFromRef.current, idx, pool));
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
  const seed = challengeSeed ?? sessionStorage.getItem("db_wheel_seed") ?? dailyChallengeSeed();
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
  const swapFromRef: { current: number | null } = { current: null };

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
            <button class="btn" id="simulate">Simulate Season</button>
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
      root.querySelector("#again")?.addEventListener("click", () => renderDraftballerWheel(root, navigate));
      root.querySelector("#hub")?.addEventListener("click", () => navigate("draftballer"));
      return;
    }

    // Rebuild the wheel for the upcoming slot so every slice can supply that
    // position — a spin can no longer land on a club with no eligible players.
    if (state.phase === "ready") {
      state = ensureSegmentsForSlot(state, pool);
    }

    const slot = currentFormationSlot(state);
    const segment = state.spunSegment;
    const pickBoard = segment ? getFullSquadPickBoard(state, pool) : [];
    const eligiblePicks = pickBoard.filter((e) => e.eligible);
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
      return;
    }

    const showWheel = state.phase === "ready" || state.phase === "spinning" || state.phase === "picking";

    root.innerHTML = `
      <div class="shell db-root db-wheel-page">
        <button class="btn btn--ghost" id="back">← Exit</button>
        <header class="db-hero" style="padding-bottom:0.75rem;margin-bottom:0.75rem">
          <p class="db-hero__label" data-wheel-ui="${WHEEL_UI_BUILD}">${mode.title ?? "Spin & Build"}</p>
          <h1 class="db-hero__title" style="font-size:clamp(1.9rem,5vw,2.7rem)">Spin. Pick. Build.</h1>
          <p style="color:var(--db-muted);font-size:0.92rem;max-width:46ch;margin:0 auto;line-height:1.5">
            Land on a real club season, draft from that squad, and fill your XI —
            the same clean loop as <strong style="color:var(--db-ink)">38-0</strong>.
          </p>
          <ol class="db-wheel-steps">
            <li>Spin the wheel</li>
            <li>Draft from a full club shortlist</li>
            <li>Place on the pitch · swap legal positions anytime</li>
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
              <div class="db-spin-result panel">
                <p class="db-hero__label">You landed on</p>
                <h3 class="db-spin-result__title">${segment.label}</h3>
                <p class="db-spin-result__era">${segment.sublabel}</p>
              </div>`
                : ""
            }
            ${
              state.phase === "ready"
                ? `<button class="btn db-spin-btn" id="spin" ${spinning ? "disabled" : ""}>Spin the wheel</button>
                   <p class="db-wheel-hint">Rerolls left: ${state.rerollsLeft} · Pick ${slot?.position ?? "—"} next · ${state.roster.length}/${state.squadSize}${
                     state.roster.length > 0
                       ? ` · Squad avg ${squadQuality.avgOvr || "—"}`
                       : ""
                   }</p>`
                : state.phase === "spinning"
                  ? `<p class="db-wheel-hint db-wheel-hint--spin">Spinning…</p>`
                  : state.fallback === "respin_free"
                    ? `<p class="db-wheel-hint">No ${slot?.position ?? "fit"} in this squad — <strong>respin</strong> for a new club</p>
                       <button class="btn db-spin-btn" id="respin-empty" type="button">Respin (${state.rerollsLeft} left)</button>`
                    : state.fallback === "out_of_position"
                      ? `<p class="db-wheel-hint">No ${slot?.position ?? "fit"} in this squad and no rerolls left — pick another slot on the pitch</p>`
                      : ""
            }
          </div>

          <div class="db-wheel-col">
            <div class="panel" style="background:var(--db-panel);border-color:var(--db-border);width:100%">
              <strong>Pitch · ${state.mode.formationId ?? "4-3-3"}</strong>
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
                    ? `Choose a <strong style="color:var(--db-ink)">${slot?.position ?? ""}</strong> from the club below`
                    : `Next: <strong style="color:var(--db-ink)">${slot?.position ?? "—"}</strong>`
                }
              </p>
              ${pitchHtml(state, poolMap, { swapHint: state.roster.length > 0, swapFrom: swapFromRef.current })}
            </div>
          </div>
        </div>

        ${
          state.phase === "picking" && segment
            ? `
          <div class="db-pick-section">
            <div class="db-pick-header">
              <p style="color:var(--db-muted);font-size:0.85rem;margin:0">
                Pick a <strong style="color:var(--db-ink)">${slot?.position ?? ""}</strong> from
                <strong style="color:var(--db-gold-hi)">${segment.label}</strong>
                · ${pickBoard.length} squad players
                ${
                  eligiblePicks.length === 0
                    ? " · <span style='color:#f5a623'>no matching players — respin for another club</span>"
                    : ""
                }
              </p>
              ${
                eligiblePicks.length
                  ? `<button class="btn btn--ghost db-random-pick" id="random-pick" type="button">Random pick</button>`
                  : state.rerollsLeft > 0
                    ? `<button class="btn btn--ghost" id="respin-empty" type="button">Respin (${state.rerollsLeft} left)</button>`
                    : ""
              }
            </div>
            ${
              squadQuality.filled > 0
                ? `<p class="db-squad-quality db-squad-quality--${squadQuality.band}">
                    Squad avg <strong>${squadQuality.avgOvr}</strong>
                    · target ${squadQuality.targetMinPickOvr}+ OVR this pick
                    · ${squadQuality.picksRemaining} left
                  </p>`
                : ""
            }
            <div class="db-pool-grid db-pool-grid--full-squad" id="pick-pool">
              ${pickBoard
                .map((entry) =>
                  playerCardHtml(entry.card, !blind, {
                    ineligible: !entry.eligible,
                    recommended: entry.recommended,
                  }),
                )
                .join("")}
            </div>
          </div>`
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
      const extraSpins = 5 + Math.floor(Math.random() * 3);
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
          wheelEl.style.transition = "transform 180ms ease-in-out";
          wheelEl.style.transform = `rotate(${wheelRotation + 4}deg)`;
          window.setTimeout(() => {
            wheelEl.style.transform = `rotate(${wheelRotation}deg)`;
          }, 160);
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
        swapFromRef.current = null;
        draw();
      } catch {
        /* invalid pick */
      }
    });

    root.querySelectorAll("#respin-empty").forEach((btn) => {
      btn.addEventListener("click", runRespin);
    });

    root.querySelectorAll("#pick-pool .db-player-card--clickable").forEach((el) => {
      el.addEventListener("click", () => {
        const id = (el as HTMLElement).dataset.id!;
        try {
          state = pickPlayerForSlot(state, id, pool);
          swapFromRef.current = null;
          draw();
        } catch {
          /* invalid pick */
        }
      });
    });
  }

  draw();
}
