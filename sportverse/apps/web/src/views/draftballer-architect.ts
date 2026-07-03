import type { DraftModeConfig } from "@sportverse/draftballer-types";
import { PRESET_MODES, buildDraftPool, poolSummary } from "@sportverse/draftballer-core";
import { setAwardsData } from "@sportverse/rating-engine";
import { getAwards, getIconicMoments } from "@sportverse/sports-db";
import { playerCardHtml } from "./draftballer-hub.js";
import { renderDraftballerWheel } from "./draftballer-wheel.js";

type Navigate = (route: string, param?: string) => void;

export function renderDraftballerArchitect(root: HTMLElement, navigate: Navigate) {
  let mode: DraftModeConfig = { ...PRESET_MODES.find((m) => m.id === "custom")! };
  let minApps = 0;
  let nationality = "";
  let legendsOnly = false;
  let primeYearsOnly = false;
  let positionLocked = false;
  let yearFrom = 1990;
  let yearTo = 2024;
  let selectedLeagues = ["premier-league", "la-liga"];
  let preview = poolSummary(
    buildDraftPool(mode, {
      minAppearances: minApps,
      nationality: nationality || undefined,
      legendsOnly,
    }),
  );

  setAwardsData(getAwards(), getIconicMoments());

  function draw() {
    root.innerHTML = `
      <div class="shell db-root">
        <button class="btn btn--ghost" id="back">← Modes</button>
        <header class="db-hero">
          <p class="db-hero__label">Draft Architect</p>
          <h1 class="db-hero__title">BUILD YOUR POOL</h1>
          <p class="db-hero__sub">Four filter axes — era, competition, eligibility, rating lens.</p>
        </header>

        <div class="db-architect-grid">
          <section class="panel db-architect-panel">
            <h2>Era</h2>
            <select id="era" class="btn btn--ghost btn--block">
              <option value="all_time" ${mode.era === "all_time" ? "selected" : ""}>All-Time (peak-4)</option>
              <option value="decade" ${mode.era === "decade" ? "selected" : ""}>Decade</option>
              <option value="single_year" ${mode.era === "single_year" ? "selected" : ""}>Single Year</option>
              <option value="custom_range" ${mode.era === "custom_range" ? "selected" : ""}>Custom Range</option>
            </select>
            <select id="decade" class="btn btn--ghost btn--block" style="margin-top:8px" ${mode.era !== "decade" ? "disabled" : ""}>
              ${["1990s", "2000s", "2010s", "2020s"]
                .map((d) => `<option value="${d}" ${mode.decade === d ? "selected" : ""}>${d}</option>`)
                .join("")}
            </select>
            <input id="year" type="number" class="btn btn--ghost btn--block" style="margin-top:8px" placeholder="Year e.g. 2020"
              value="${mode.year ?? ""}" ${mode.era !== "single_year" ? "disabled" : ""} />
            <div style="display:flex;gap:8px;margin-top:8px" ${mode.era !== "custom_range" ? "hidden" : ""} id="year-range">
              <input id="yearFrom" type="number" class="btn btn--ghost" style="flex:1" value="${yearFrom}" placeholder="From" />
              <input id="yearTo" type="number" class="btn btn--ghost" style="flex:1" value="${yearTo}" placeholder="To" />
            </div>
            <label style="margin-top:8px;display:flex;align-items:center;gap:8px;cursor:pointer">
              <input type="checkbox" id="prime-years" ${primeYearsOnly ? "checked" : ""} />
              Prime years only (top-4 seasons)
            </label>
          </section>

          <section class="panel db-architect-panel">
            <h2>Competition</h2>
            <select id="scope" class="btn btn--ghost btn--block">
              <option value="any_league" ${mode.competitionScope === "any_league" ? "selected" : ""}>Any League</option>
              <option value="single_league" ${mode.competitionScope === "single_league" ? "selected" : ""}>Premier League</option>
              <option value="continental" ${mode.competitionScope === "continental" ? "selected" : ""}>Continental (UCL/UEL)</option>
              <option value="international" ${mode.competitionScope === "international" ? "selected" : ""}>International</option>
              <option value="custom" ${mode.competitionScope === "custom" ? "selected" : ""}>Custom league set</option>
            </select>
            <div id="league-set" style="margin-top:8px;${mode.competitionScope === "custom" ? "" : "display:none"}" >
              ${["premier-league", "la-liga", "serie-a", "bundesliga", "ligue-1", "eredivisie"]
                .map(
                  (id) =>
                    `<label style="display:flex;gap:6px;margin:4px 0;font-size:0.85rem"><input type="checkbox" class="league-cb" value="${id}" ${selectedLeagues.includes(id) ? "checked" : ""}/> ${id.replace(/-/g, " ")}</label>`,
                )
                .join("")}
            </div>
          </section>

          <section class="panel db-architect-panel">
            <h2>Eligibility</h2>
            <label>Min career appearances</label>
            <input id="minApps" type="range" min="0" max="100" value="${minApps}" />
            <span id="minAppsLabel">${minApps}+ apps</span>
            <label style="margin-top:8px;display:block">Nationality contains</label>
            <input id="nat" class="btn btn--ghost btn--block" placeholder="e.g. Brazil" value="${nationality}" />
            <label style="margin-top:8px;display:flex;align-items:center;gap:8px;cursor:pointer">
              <input type="checkbox" id="legends-only" ${legendsOnly ? "checked" : ""} />
              Legends only
            </label>
            <label style="margin-top:8px;display:flex;align-items:center;gap:8px;cursor:pointer">
              <input type="checkbox" id="position-locked" ${positionLocked ? "checked" : ""} />
              Position-locked draft
            </label>
          </section>

          <section class="panel db-architect-panel">
            <h2>Rating lens</h2>
            <label>Club ←→ International (${Math.round(mode.blendFactor * 100)}% intl)</label>
            <input type="range" id="blend" min="0" max="100" value="${Math.round(mode.blendFactor * 100)}" />
            <select id="lens" class="btn btn--ghost btn--block" style="margin-top:8px">
              <option value="blended" ${mode.ratingLens === "blended" ? "selected" : ""}>Blended</option>
              <option value="club_only" ${mode.ratingLens === "club_only" ? "selected" : ""}>Club only</option>
              <option value="international_only" ${mode.ratingLens === "international_only" ? "selected" : ""}>International only</option>
              <option value="best_context" ${mode.ratingLens === "best_context" ? "selected" : ""}>Best context</option>
            </select>
            <label style="margin-top:12px;display:flex;align-items:center;gap:8px;cursor:pointer">
              <input type="checkbox" id="raw-domestic" ${mode.rawDomesticDominance ? "checked" : ""} />
              Raw Domestic Dominance (skip league bridging)
            </label>
            <p style="color:var(--db-muted);font-size:0.75rem;margin-top:4px">When off, cross-league LSI bridging applies in Any League / All-Time modes.</p>
          </section>
        </div>

        <div class="panel" style="margin-top:16px;background:var(--db-panel);border-color:var(--db-border)">
          <p style="color:var(--db-muted);font-size:0.85rem">
            Pool: <strong style="color:var(--db-gold)">${preview.count}</strong> players ·
            Avg OVR <strong>${preview.avgOvr}</strong>
          </p>
          <div class="db-pool-grid" style="margin-top:12px">
            ${preview.top.map((c) => playerCardHtml(c, true)).join("")}
          </div>
          <button class="btn" id="start-wheel" style="margin-top:12px;width:100%">Spin & Build (Wheel)</button>
          <button class="btn btn--ghost" id="start" style="margin-top:8px;width:100%">Snake Draft vs Bot</button>
          <button class="btn btn--ghost" id="start-mp" style="margin-top:8px;width:100%">Multiplayer Lobby</button>
        </div>
      </div>`;

    root.querySelector("#back")?.addEventListener("click", () => navigate("draftballer"));
    const update = () => {
      mode = {
        ...mode,
        primeYearsOnly,
        positionLocked,
        yearFrom: mode.era === "custom_range" ? yearFrom : undefined,
        yearTo: mode.era === "custom_range" ? yearTo : undefined,
        leagueIds: mode.competitionScope === "custom" ? selectedLeagues : undefined,
      };
      preview = poolSummary(
        buildDraftPool(mode, {
          minAppearances: minApps,
          nationality: nationality || undefined,
          legendsOnly,
        }),
      );
      draw();
    };
    root.querySelector("#blend")?.addEventListener("input", (e) => {
      const v = Number((e.target as HTMLInputElement).value) / 100;
      mode = { ...mode, blendFactor: v, ratingLens: v <= 0.05 ? "club_only" : v >= 0.95 ? "international_only" : mode.ratingLens };
      update();
    });
    root.querySelector("#lens")?.addEventListener("change", (e) => {
      mode = { ...mode, ratingLens: (e.target as HTMLSelectElement).value as DraftModeConfig["ratingLens"] };
      update();
    });
    root.querySelector("#raw-domestic")?.addEventListener("change", (e) => {
      mode = { ...mode, rawDomesticDominance: (e.target as HTMLInputElement).checked };
      update();
    });
    root.querySelector("#era")?.addEventListener("change", (e) => {
      mode = { ...mode, era: (e.target as HTMLSelectElement).value as DraftModeConfig["era"] };
      update();
    });
    root.querySelector("#yearFrom")?.addEventListener("change", (e) => {
      yearFrom = Number((e.target as HTMLInputElement).value) || 1990;
      update();
    });
    root.querySelector("#yearTo")?.addEventListener("change", (e) => {
      yearTo = Number((e.target as HTMLInputElement).value) || 2024;
      update();
    });
    root.querySelector("#prime-years")?.addEventListener("change", (e) => {
      primeYearsOnly = (e.target as HTMLInputElement).checked;
      update();
    });
    root.querySelector("#legends-only")?.addEventListener("change", (e) => {
      legendsOnly = (e.target as HTMLInputElement).checked;
      update();
    });
    root.querySelector("#position-locked")?.addEventListener("change", (e) => {
      positionLocked = (e.target as HTMLInputElement).checked;
      update();
    });
    root.querySelectorAll(".league-cb").forEach((el) => {
      el.addEventListener("change", () => {
        selectedLeagues = [...root.querySelectorAll<HTMLInputElement>(".league-cb:checked")].map((x) => x.value);
        update();
      });
    });
    root.querySelector("#decade")?.addEventListener("change", (e) => {
      mode = { ...mode, decade: (e.target as HTMLSelectElement).value };
      update();
    });
    root.querySelector("#year")?.addEventListener("change", (e) => {
      mode = { ...mode, year: Number((e.target as HTMLInputElement).value) || undefined };
      update();
    });
    root.querySelector("#scope")?.addEventListener("change", (e) => {
      const scope = (e.target as HTMLSelectElement).value as DraftModeConfig["competitionScope"];
      mode = {
        ...mode,
        competitionScope: scope,
        leagueId: scope === "single_league" ? "premier-league" : undefined,
        leagueIds: scope === "custom" ? selectedLeagues : undefined,
      };
      update();
    });
    root.querySelector("#minApps")?.addEventListener("input", (e) => {
      minApps = Number((e.target as HTMLInputElement).value);
      update();
    });
    root.querySelector("#nat")?.addEventListener("change", (e) => {
      nationality = (e.target as HTMLInputElement).value.trim();
      update();
    });
    root.querySelector("#start-wheel")?.addEventListener("click", () => {
      sessionStorage.setItem("db_mode", JSON.stringify(mode));
      navigate("draftballer", "wheel");
    });
    root.querySelector("#start")?.addEventListener("click", () => {
      sessionStorage.setItem("db_mode", JSON.stringify(mode));
      navigate("draftballer", "room");
    });
    root.querySelector("#start-mp")?.addEventListener("click", () => {
      sessionStorage.setItem("db_mode", JSON.stringify(mode));
      navigate("draftballer", "mp-lobby");
    });
  }

  draw();
}

export function renderDraftballerQuick(root: HTMLElement, modeId: string, navigate: Navigate) {
  const mode = PRESET_MODES.find((m) => m.id === modeId) ?? PRESET_MODES[0]!;
  sessionStorage.setItem("db_mode", JSON.stringify(mode));
  renderDraftballerWheel(root, navigate);
}
