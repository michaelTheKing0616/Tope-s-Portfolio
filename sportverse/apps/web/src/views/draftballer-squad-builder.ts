import type { SimMatchConfig } from "@sportverse/draftballer-types";
import { loadSquadForSeason, loadSquadBuilderState, saveSquadBuilderState } from "@sportverse/draftballer-core";
import { formationsForEra, getFormation } from "@sportverse/match-sim";
import { loadSimConfig, saveSimConfig } from "@sportverse/draftballer-core";
import { computeSquadRating } from "@sportverse/rating-engine";
import { pitchSurfaceHtml } from "./draftballer-pitch.js";

type Navigate = (route: string, param?: string) => void;

/** Squad Builder — formation picker + tactical identity (Formation System v1 §2.2). */
export function renderDraftballerSquadBuilder(root: HTMLElement, navigate: Navigate) {
  const saved = loadSquadForSeason();
  if (!saved?.players.length) {
    root.innerHTML = `<div class="shell db-root"><p>Complete a draft first.</p><button class="btn" id="hub">Hub</button></div>`;
    root.querySelector("#hub")?.addEventListener("click", () => navigate("draftballer"));
    return;
  }

  const builder = loadSquadBuilderState();
  const simConfig = loadSimConfig();
  const eraDecade = saved.mode.decade ?? "2020s";
  const formations = formationsForEra(eraDecade);
  const rating = computeSquadRating(saved.players, { formationId: builder.formationId });

  root.innerHTML = `
    <div class="shell db-root">
      <button class="btn btn--ghost" id="back">← Season</button>
      <header class="db-hero">
        <p class="db-hero__label">Squad Builder</p>
        <h1 class="db-hero__title">FORMATION & TACTICS</h1>
      </header>
      <div class="db-formation-grid">
        ${formations
          .map(
            (f) => `
          <button class="db-formation-btn ${builder.formationId === f.id ? "db-formation-btn--active" : ""}" data-id="${f.id}">
            <strong>${f.name}</strong>
            <span>${f.backLineCount} at the back · ${f.widthCategory}</span>
          </button>`,
          )
          .join("")}
      </div>
      <div class="panel" style="margin-top:12px">
        <label>Tactical identity</label>
        <select id="identity" class="btn btn--ghost btn--block">
          ${(["balanced", "possession", "high_press", "counter", "route_one"] as const).map(
            (i) =>
              `<option value="${i}" ${builder.tacticalIdentity === i ? "selected" : ""}>${i.replace("_", " ")}</option>`,
          )}
        </select>
        <p style="font-size:0.8rem;color:var(--db-muted);margin-top:8px">Era-authentic sort active for ${eraDecade}. Anachronistic picks are allowed.</p>
      </div>
      <div class="db-pitch-preview panel" style="margin-top:12px;min-height:180px;position:relative">
        ${pitchSurfaceHtml(renderPitchDots(getFormation(builder.formationId).slots), {
          flat: true,
          ariaLabel: `${builder.formationId} preview`,
        })}
      </div>
      <div class="panel db-squad-rating" style="margin-top:12px">
        <p class="db-hero__label">Squad rating</p>
        <p style="font-family:var(--font-display);font-size:2rem;color:var(--db-gold);margin:0.25rem 0">${rating.squadRating}</p>
        <div class="db-breakdown-grid">
          <div><span class="db-stat-label">CF (correction)</span><strong>+${rating.correctionFactor}</strong></div>
          <div><span class="db-stat-label">Chemistry</span><strong>+${rating.chemistryBonus}</strong></div>
          <div><span class="db-stat-label">Zone coherence</span><strong>+${rating.zoneCoherenceBonus}</strong></div>
          <div><span class="db-stat-label">Flat average</span><strong>${rating.flatAverage}</strong></div>
        </div>
      </div>
      <button class="btn btn--ghost" id="canvas" style="width:100%;margin-top:12px">Custom formation canvas</button>
      <button class="btn" id="save" style="width:100%;margin-top:8px">Save squad setup</button>
      <button class="btn btn--ghost" id="simSetup" style="width:100%;margin-top:8px">Simulation conditions</button>
    </div>`;

  root.querySelector("#back")?.addEventListener("click", () => navigate("draftballer", "season"));
  root.querySelector("#canvas")?.addEventListener("click", () => navigate("draftballer", "formation-canvas"));
  root.querySelectorAll<HTMLElement>(".db-formation-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      builder.formationId = btn.dataset.id!;
      drawPitch();
      root.querySelectorAll(".db-formation-btn").forEach((b) => b.classList.remove("db-formation-btn--active"));
      btn.classList.add("db-formation-btn--active");
    });
  });
  root.querySelector("#identity")?.addEventListener("change", (e) => {
    builder.tacticalIdentity = (e.target as HTMLSelectElement).value as SimMatchConfig["tacticalIdentityHome"];
  });
  root.querySelector("#save")?.addEventListener("click", () => {
    saveSquadBuilderState(builder);
    saveSimConfig({
      ...simConfig,
      formationHomeId: builder.formationId,
      tacticalIdentityHome: builder.tacticalIdentity,
    });
    const raw = sessionStorage.getItem("db_squad");
    if (raw) {
      const payload = JSON.parse(raw);
      payload.formationId = builder.formationId;
      payload.tacticalIdentity = builder.tacticalIdentity;
      sessionStorage.setItem("db_squad", JSON.stringify(payload));
    }
    navigate("draftballer", "season");
  });
  root.querySelector("#simSetup")?.addEventListener("click", () => navigate("draftballer", "sim-setup"));

  function drawPitch() {
    const el = root.querySelector(".db-pitch-preview");
    if (el) {
      el.innerHTML = pitchSurfaceHtml(renderPitchDots(getFormation(builder.formationId).slots), {
        flat: true,
        ariaLabel: `${builder.formationId} preview`,
      });
    }
  }
}

function renderPitchDots(slots: { x: number; y: number; positionTag: string }[]): string {
  return slots
    .map(
      (s) =>
        `<span class="db-pitch-dot" style="left:${s.y}%;top:${100 - s.x}%" title="${s.positionTag}">${s.positionTag.slice(0, 2)}</span>`,
    )
    .join("");
}
