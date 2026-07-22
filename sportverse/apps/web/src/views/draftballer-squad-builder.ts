import type { SimMatchConfig } from "@sportverse/draftballer-types";
import { loadSquadForSeason, loadSquadBuilderState, saveSquadBuilderState } from "@sportverse/draftballer-core";
import { formationsForEra, getFormation } from "@sportverse/match-sim";
import { loadSimConfig, saveSimConfig } from "@sportverse/draftballer-core";
import { computeSquadRating } from "@sportverse/rating-engine";
import { pitchSlotChipHtml, pitchSurfaceHtml } from "./draftballer-pitch.js";
import { bindEliteMotion } from "../lib/elite-motion.js";

type Navigate = (route: string, param?: string) => void;

function injectPitchScanBand(wrap: HTMLElement | null) {
  if (!wrap || wrap.querySelector(".db-scan-band")) return;
  const scan = document.createElement("div");
  scan.className = "db-scan-band";
  scan.setAttribute("aria-hidden", "true");
  wrap.prepend(scan);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

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
  const formation = getFormation(builder.formationId);
  const playerMap = new Map(saved.players.map((p) => [p.playerId, p]));

  function renderTacticalPitch(formationId: string): string {
    const form = getFormation(formationId);
    const slots = form.slots
      .map((coord, i) => {
        const pid = saved!.playerIds[i];
        const player = pid ? playerMap.get(pid) : undefined;
        const chip = pitchSlotChipHtml({
          ovr: player?.ovr,
          position: coord.positionTag,
          empty: !player,
          active: !player,
          title: player ? `${player.name} · ${player.ovr}` : `${coord.positionTag} · empty`,
        });
        return `
          <div class="db-tactical-slot" style="left:${coord.y}%;top:${100 - coord.x}%">
            ${chip}
          </div>`;
      })
      .join("");
    return pitchSurfaceHtml(slots, {
      className: "db-tactical-pitch-surface",
      flat: true,
      ariaLabel: `${formationId} tactical pitch`,
    });
  }

  const nextEmptyIdx = saved.playerIds.findIndex((id) => !id);
  root.innerHTML = `
    <div class="shell db-root db-tactical-page">
      <button class="btn btn--ghost" id="back">← Season</button>

      <header class="db-tactical-header">
        <div>
          <span class="db-tactical-badge db-label-caps">Formation Matrix</span>
          <h1 class="db-tactical-title">Active Squad</h1>
          <p class="db-tactical-formation">${escapeHtml(builder.formationId)} · ${escapeHtml(formation.name)}</p>
        </div>
        <div class="db-tactical-ovr">
          <div class="db-tactical-ovr__value">${rating.squadRating}</div>
          <span class="db-label-caps">Team Rating</span>
        </div>
      </header>

      <div class="db-tactical-pitch-wrap">
        ${renderTacticalPitch(builder.formationId)}
      </div>

      <section class="db-tactical-selection">
        <p class="db-label-caps">Current Selection</p>
        <h2>Next: ${nextEmptyIdx >= 0 ? formation.slots[nextEmptyIdx]?.positionTag ?? "Slot" : "Squad Complete"}</h2>
      </section>

      <div class="db-tactical-formations">
        ${formations
          .map(
            (f) => `
          <button type="button" class="db-glass db-tactical-form-btn ${builder.formationId === f.id ? "db-tactical-form-btn--active" : ""}" data-id="${f.id}">
            <strong>${f.name}</strong>
            <span>${f.backLineCount} at back · ${f.widthCategory}</span>
          </button>`,
          )
          .join("")}
      </div>

      <div class="db-glass db-tactical-panel">
        <label class="db-label-caps" for="identity">Tactical identity</label>
        <select id="identity" class="btn btn--ghost btn--block">
          ${(["balanced", "possession", "high_press", "counter", "route_one"] as const).map(
            (i) =>
              `<option value="${i}" ${builder.tacticalIdentity === i ? "selected" : ""}>${i.replace("_", " ")}</option>`,
          )}
        </select>
        <p class="db-tactical-note">Era-authentic sort active for ${eraDecade}.</p>
      </div>

      <div class="db-glass db-tactical-roster">
        <p class="db-label-caps">Squad List</p>
        <ul class="db-tactical-roster-list">
          ${saved.players
            .map(
              (p) => `
            <li class="db-tactical-roster-row">
              <span class="db-tactical-roster-ovr">${p.ovr}</span>
              <div>
                <strong>${escapeHtml(p.name)}</strong>
                <span>${p.position}${p.contextLine ? ` · ${escapeHtml(p.contextLine.split("·").pop()?.trim() ?? "")}` : ""}</span>
              </div>
            </li>`,
            )
            .join("")}
        </ul>
        <div class="db-tactical-breakdown">
          <div><span class="db-label-caps">Chemistry</span><strong>+${rating.chemistryBonus}</strong></div>
          <div><span class="db-label-caps">Zone</span><strong>+${rating.zoneCoherenceBonus}</strong></div>
          <div><span class="db-label-caps">Flat avg</span><strong>${rating.flatAverage}</strong></div>
        </div>
      </div>

      <button class="btn btn--ghost db-tactical-canvas-link" id="canvas" type="button">Custom formation canvas</button>
      <button class="db-btn-pitch db-tactical-save" id="save" type="button">Save squad setup</button>
      <button class="btn btn--ghost" id="simSetup" type="button">Simulation conditions</button>
    </div>`;

  root.querySelector("#back")?.addEventListener("click", () => navigate("draftballer", "season"));
  root.querySelector("#canvas")?.addEventListener("click", () => navigate("draftballer", "formation-canvas"));
  root.querySelectorAll<HTMLElement>(".db-tactical-form-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      builder.formationId = btn.dataset.id!;
      const pitchEl = root.querySelector(".db-tactical-pitch-wrap");
      if (pitchEl) {
        pitchEl.innerHTML = renderTacticalPitch(builder.formationId);
        injectPitchScanBand(pitchEl as HTMLElement);
      }
      root.querySelectorAll(".db-tactical-form-btn").forEach((b) => b.classList.remove("db-tactical-form-btn--active"));
      btn.classList.add("db-tactical-form-btn--active");
      const formLabel = root.querySelector(".db-tactical-formation");
      if (formLabel) {
        const f = getFormation(builder.formationId);
        formLabel.textContent = `${builder.formationId} · ${f.name}`;
      }
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

  const pageRoot = root.querySelector(".db-root") as HTMLElement | null;
  if (pageRoot) bindEliteMotion(pageRoot, { scan: "none" });
  injectPitchScanBand(root.querySelector(".db-tactical-pitch-wrap") as HTMLElement | null);
}
