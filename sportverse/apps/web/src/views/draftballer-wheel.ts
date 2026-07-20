import type { DraftModeConfig, RatedPlayerCard, WheelBuildState } from "@sportverse/draftballer-types";
import {
  buildDraftPool,
  createWheelSession,
  currentFormationSlot,
  filterPlayersForSegment,
  getPickCandidates,
  getPresetMode,
  listWheelFormationIds,
  pickPlayerForSlot,
  randomSegmentIndex,
  spinToSegment,
  dailyChallengeSeed,
  saveSquadForSeason,
} from "@sportverse/draftballer-core";
import { computeSquadRating } from "@sportverse/rating-engine";
import { playerCardHtml } from "./draftballer-hub.js";
import { bindPlayerCardBreakdownsWithPool } from "./draftballer-breakdown.js";
import { submitDailyScore } from "./draftballer-daily.js";
import { playDraftSound } from "../lib/draft-sound.js";
import { mountStagedReveal } from "../lib/staged-reveal.js";
import { bindIdentityPicker, identityPickerHtml } from "./draftballer-identity.js";

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
      // Early: ~55ms; late: ~220ms — tension as it slows.
      nextAt += 55 + t * t * 165;
    }
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  return () => {
    cancelled = true;
  };
}

function wheelSegmentHtml(segments: WheelBuildState["segments"], activeIndex: number | null): string {
  const n = segments.length;
  const slice = 360 / n;
  const colors = ["#1c2128", "#12161c", "#1a2332", "#151a22"];

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
      return `<span class="db-wheel-label${highlight}" style="--a:${angle}deg;left:${x}%;top:${y}%">${seg.label.split(" ")[0]}</span>`;
    })
    .join("");

  return `
    <div class="db-wheel-wrap">
      <div class="db-wheel-pointer" aria-hidden="true"></div>
      <div class="db-wheel" id="wheel" style="background:conic-gradient(from -90deg, ${gradientStops})">
        ${labels}
      </div>
      <div class="db-wheel-hub">SPIN</div>
    </div>`;
}

function formationHtml(state: WheelBuildState, poolMap: Map<string, RatedPlayerCard>): string {
  return `
    <div class="db-formation">
      ${state.formation
        .map((slot, i) => {
          const filled = slot.playerId ? poolMap.get(slot.playerId) : null;
          const active = i === state.currentSlotIndex && state.phase !== "complete";
          return `
            <div class="db-formation-slot ${active ? "db-formation-slot--active" : ""} ${filled ? "db-formation-slot--filled" : ""}" data-pos="${slot.position}">
              <span class="db-formation-pos">${slot.position}</span>
              <span class="db-formation-name">${filled ? filled.name.split(" ").pop() : "—"}</span>
            </div>`;
        })
        .join("")}
    </div>`;
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
  let wheelRotation = 0;

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
            ${formationHtml(state, poolMap)}
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

    const slot = currentFormationSlot(state);
    const segment = state.spunSegment;
    const picked = new Set(state.roster);
    const candidates = segment ? getPickCandidates(state, pool) : [];
    const exactPosCount =
      segment && slot
        ? filterPlayersForSegment(segment, pool, picked, slot.position).length
        : candidates.length;

    root.innerHTML = `
      <div class="shell db-root db-wheel-page">
        <button class="btn btn--ghost" id="back">← Exit</button>
        <header class="db-hero" style="padding-bottom:0.75rem;margin-bottom:0.75rem">
          <p class="db-hero__label">${mode.title ?? "Spin & Build"} · Wheel Draft</p>
          <h1 class="db-hero__title" style="font-size:clamp(1.8rem,5vw,2.8rem)">SPIN · PICK · BUILD</h1>
          <p style="color:var(--db-muted);font-size:0.85rem;max-width:52ch;margin:0 auto">
            Spin for a club or nation + era, draft into your formation — same loop as
            <strong style="color:var(--db-gold-hi)">38-0</strong>.
          </p>
          <ol class="db-wheel-steps">
            <li>Spin the wheel</li>
            <li>Draft a player from that slice</li>
            <li>Fill all 11 slots</li>
          </ol>
        </header>

        <div class="db-wheel-layout">
          <div class="db-wheel-col">
            ${state.phase === "ready" || state.phase === "spinning" ? wheelSegmentHtml(state.segments, state.phase === "picking" ? spinTargetIndex : null) : ""}
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
                ? `<button class="btn db-spin-btn" id="spin">Spin the wheel</button>
                   <p class="db-wheel-hint">Rerolls left: ${state.rerollsLeft} · Pick ${slot?.position ?? "—"} next · ${state.roster.length}/${state.squadSize}</p>`
                : state.phase === "spinning"
                  ? `<p class="db-wheel-hint db-wheel-hint--spin">Spinning…</p>`
                  : state.fallback
                    ? `<p class="db-wheel-hint">No GK in this squad — ${state.fallback === "respin_free" ? "free respin available" : "out-of-position penalty applies"}</p>`
                    : ""
            }
          </div>

          <div class="db-wheel-col">
            <div class="panel" style="background:var(--db-panel);border-color:var(--db-border)">
              <strong>Formation</strong>
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
                  : `<p style="font-size:0.75rem;color:var(--db-muted);margin:4px 0">${state.mode.formationId ?? "4-3-3"}</p>`
              }
              <p style="font-size:0.75rem;color:var(--db-muted);margin:4px 0 10px">
                ${state.phase === "picking" ? `Choose a ${slot?.position ?? ""} from the squad below` : `Next slot: ${slot?.position ?? "—"}`}
              </p>
              ${formationHtml(state, poolMap)}
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
                ${exactPosCount === 0 ? " · <span style='color:#f5a623'>no exact matches — showing alternatives</span>" : ""}
              </p>
              <button class="btn btn--ghost db-random-pick" id="random-pick" type="button">Random pick</button>
            </div>
            <div class="db-pool-grid" id="pick-pool">
              ${candidates
                .slice(0, 16)
                .map((c) => playerCardHtml(c, !blind))
                .join("")}
            </div>
          </div>`
            : ""
        }
      </div>`;

    root.querySelector("#back")?.addEventListener("click", () => navigate("draftballer"));

    root.querySelector("#formationPick")?.addEventListener("change", (e) => {
      if (state.roster.length > 0) return;
      const formationId = (e.target as HTMLSelectElement).value;
      const nextMode = { ...mode, formationId };
      sessionStorage.setItem("db_mode", JSON.stringify(nextMode));
      Object.assign(mode, nextMode);
      state = createWheelSession(nextMode, pool, state.seed);
      draw();
    });

    root.querySelector("#spin")?.addEventListener("click", () => {
      if (state.phase !== "ready") return;
      spinTargetIndex = randomSegmentIndex(state.segments, state.seed);
      state = { ...state, phase: "spinning" };

      const n = state.segments.length;
      const slice = 360 / n;
      const targetAngle = 360 - (spinTargetIndex * slice + slice / 2);
      // Cosmetics only — not gameplay RNG.
      const extraSpins = 5 + Math.floor(Math.random() * 3);
      wheelRotation += extraSpins * 360 + targetAngle - (wheelRotation % 360);

      const spinMs = prefersReducedMotion() ? 200 : SPIN_MS;
      draw();

      const wheelEl = root.querySelector("#wheel") as HTMLElement | null;
      const wrapEl = root.querySelector(".db-wheel-wrap") as HTMLElement | null;
      if (wheelEl) {
        wheelEl.style.transition = `transform ${spinMs}ms cubic-bezier(0.22, 1, 0.36, 1)`;
        wheelEl.style.transform = `rotate(${wheelRotation}deg)`;
      }

      const cancelTicks = prefersReducedMotion()
        ? () => undefined
        : scheduleSpinTicks(spinMs, () => playDraftSound("tick"));

      window.setTimeout(() => {
        cancelTicks();
        const landed = state.segments[spinTargetIndex];
        // Near-miss wobble then settle (skipped under reduced motion).
        if (wheelEl && !prefersReducedMotion()) {
          wheelEl.style.transition = "transform 180ms ease-in-out";
          wheelEl.style.transform = `rotate(${wheelRotation + 4}deg)`;
          window.setTimeout(() => {
            wheelEl.style.transform = `rotate(${wheelRotation}deg)`;
          }, 160);
        }
        state = spinToSegment(state, spinTargetIndex, pool);
        playDraftSound("land");
        if (landed && (landed.fameSum ?? 0) >= ICON_FAME_SUM_FLASH) {
          wrapEl?.classList.add("db-wheel-wrap--gold-flash");
          playDraftSound("crowd");
        }
        draw();
      }, spinMs + 80);
    });

    root.querySelector("#random-pick")?.addEventListener("click", () => {
      if (state.phase !== "picking" || candidates.length === 0) return;
      const pick = candidates[Math.floor(Math.random() * candidates.length)]!;
      try {
        state = pickPlayerForSlot(state, pick.playerId, pool);
        draw();
      } catch {
        /* invalid pick */
      }
    });

    root.querySelectorAll("#pick-pool .db-player-card").forEach((el) => {
      el.addEventListener("click", () => {
        const id = (el as HTMLElement).dataset.id!;
        try {
          state = pickPlayerForSlot(state, id, pool);
          draw();
        } catch {
          /* invalid pick */
        }
      });
    });
  }

  draw();
}
