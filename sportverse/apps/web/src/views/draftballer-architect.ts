import type { DraftModeConfig } from "@sportverse/draftballer-types";
import { PRESET_MODES, buildDraftPool, poolSummary } from "@sportverse/draftballer-core";
import { playerCardHtml } from "./draftballer-hub.js";

type Navigate = (route: string, param?: string) => void;

export function renderDraftballerArchitect(root: HTMLElement, navigate: Navigate) {
  let mode: DraftModeConfig = { ...PRESET_MODES.find((m) => m.id === "custom")! };
  let preview = poolSummary(buildDraftPool(mode));

  function draw() {
    root.innerHTML = `
      <div class="shell db-root">
        <button class="btn btn--ghost" id="back">← Modes</button>
        <header class="db-hero">
          <p class="db-hero__label">Draft Architect</p>
          <h1 class="db-hero__title">BUILD YOUR POOL</h1>
        </header>

        <div class="panel" style="background:var(--db-panel);border-color:var(--db-border)">
          <div class="db-slider-row">
            <label>Rating lens — Club ←→ International (${Math.round(mode.blendFactor * 100)}% intl)</label>
            <input type="range" id="blend" min="0" max="100" value="${Math.round(mode.blendFactor * 100)}" />
          </div>
          <div class="db-slider-row">
            <label>Era</label>
            <select id="era" class="btn btn--ghost btn--block">
              <option value="all_time" ${mode.era === "all_time" ? "selected" : ""}>All-Time</option>
              <option value="decade" ${mode.era === "decade" ? "selected" : ""}>Decade</option>
              <option value="single_year" ${mode.era === "single_year" ? "selected" : ""}>Single Year</option>
            </select>
          </div>
          <div class="db-slider-row">
            <label>Competition scope</label>
            <select id="scope" class="btn btn--ghost btn--block">
              <option value="any_league" ${mode.competitionScope === "any_league" ? "selected" : ""}>Any League</option>
              <option value="single_league" ${mode.competitionScope === "single_league" ? "selected" : ""}>Premier League only</option>
              <option value="international" ${mode.competitionScope === "international" ? "selected" : ""}>International</option>
            </select>
          </div>
          <p style="color:var(--db-muted);font-size:0.85rem">
            Pool: <strong style="color:var(--db-gold)">${preview.count}</strong> players ·
            Avg OVR <strong>${preview.avgOvr}</strong>
          </p>
          <div class="db-pool-grid" style="margin-top:12px">
            ${preview.top.map((c) => playerCardHtml(c, true)).join("")}
          </div>
          <button class="btn" id="start" style="margin-top:16px;width:100%">Start Snake Draft</button>
        </div>
      </div>`;

    root.querySelector("#back")?.addEventListener("click", () => navigate("draftballer"));
    const update = () => {
      preview = poolSummary(buildDraftPool(mode));
      draw();
    };
    root.querySelector("#blend")?.addEventListener("input", (e) => {
      const v = Number((e.target as HTMLInputElement).value) / 100;
      mode = {
        ...mode,
        blendFactor: v,
        ratingLens: v <= 0.05 ? "club_only" : v >= 0.95 ? "international_only" : "blended",
      };
      update();
    });
    root.querySelector("#era")?.addEventListener("change", (e) => {
      mode = { ...mode, era: (e.target as HTMLSelectElement).value as DraftModeConfig["era"] };
      update();
    });
    root.querySelector("#scope")?.addEventListener("change", (e) => {
      const scope = (e.target as HTMLSelectElement).value as DraftModeConfig["competitionScope"];
      mode = {
        ...mode,
        competitionScope: scope,
        leagueId: scope === "single_league" ? "premier-league" : undefined,
      };
      update();
    });
    root.querySelector("#start")?.addEventListener("click", () => {
      sessionStorage.setItem("db_mode", JSON.stringify(mode));
      navigate("draftballer/room");
    });
  }

  draw();
}

export function renderDraftballerQuick(root: HTMLElement, modeId: string, navigate: Navigate) {
  const mode = PRESET_MODES.find((m) => m.id === modeId) ?? PRESET_MODES[0]!;
  sessionStorage.setItem("db_mode", JSON.stringify(mode));
  navigate("draftballer/room");
}
