import type { SimMatchConfig } from "@sportverse/draftballer-types";
import { listEraProfiles, FORMATIONS } from "@sportverse/match-sim";
import { loadSimConfig, saveSimConfig } from "@sportverse/draftballer-core";

type Navigate = (route: string, param?: string) => void;

const ERA_OPTIONS = listEraProfiles();
const FORMATION_LIST = FORMATIONS;
const IDENTITIES: SimMatchConfig["tacticalIdentityHome"][] = [
  "balanced",
  "possession",
  "high_press",
  "counter",
  "route_one",
];
const WEATHER: SimMatchConfig["weather"][] = ["clear", "rain", "wind", "heat", "random"];

/** Pre-match simulation setup — Era context, tactics, weather, Prime Powers toggle (§1.2, §10). */
export function renderDraftballerSimSetup(root: HTMLElement, navigate: Navigate, returnRoute: string) {
  let config = loadSimConfig();

  function draw() {
    root.innerHTML = `
      <div class="shell db-root">
        <button class="btn btn--ghost" id="back">← Back</button>
        <header class="db-hero">
          <p class="db-hero__label">Match Setup</p>
          <h1 class="db-hero__title">SIMULATION CONDITIONS</h1>
          <p class="db-hero__sub">Draft era ≠ simulation era. Configure how the match plays out.</p>
        </header>

        <div class="panel db-architect-panel">
          <label><input type="checkbox" id="realistic" ${config.simulationMode === "realistic" ? "checked" : ""} />
            Realistic Era Simulation (recommended)</label>
          <p style="font-size:0.8rem;color:var(--db-muted)">Off = Prime Powers Mode (pure base OVR, no era penalties)</p>
        </div>

        <div class="db-architect-grid">
          <section class="panel db-architect-panel">
            <h2>Simulation Era</h2>
            <select id="eraMode" class="btn btn--ghost btn--block">
              <option value="neutral_modern" ${config.eraContext.mode === "neutral_modern" ? "selected" : ""}>Modern neutral (~2020s)</option>
              <option value="match_higher_draft" ${config.eraContext.mode === "match_higher_draft" ? "selected" : ""}>Match higher-drafted squad era</option>
              <option value="custom" ${config.eraContext.mode === "custom" ? "selected" : ""}>Custom decade</option>
              <option value="historical_recreation" ${config.eraContext.mode === "historical_recreation" ? "selected" : ""}>Historical recreation</option>
            </select>
            <select id="eraProfile" class="btn btn--ghost btn--block" style="margin-top:8px">
              ${ERA_OPTIONS.map((p) => `<option value="${p.id}" ${config.eraContext.profileId === p.id ? "selected" : ""}>${p.label}</option>`).join("")}
            </select>
          </section>

          <section class="panel db-architect-panel">
            <h2>Tactics & Formation</h2>
            <label>Your identity</label>
            <select id="identity" class="btn btn--ghost btn--block">
              ${IDENTITIES.map((i) => `<option value="${i}" ${config.tacticalIdentityHome === i ? "selected" : ""}>${i.replace("_", " ")}</option>`).join("")}
            </select>
            <label style="margin-top:8px">Formation</label>
            <select id="formation" class="btn btn--ghost btn--block">
              ${FORMATION_LIST.map((f) => `<option value="${f.id}" ${config.formationHomeId === f.id ? "selected" : ""}>${f.name}</option>`).join("")}
            </select>
          </section>

          <section class="panel db-architect-panel">
            <h2>Conditions</h2>
            <label>Weather</label>
            <select id="weather" class="btn btn--ghost btn--block">
              ${WEATHER.map((w) => `<option value="${w}" ${config.weather === w ? "selected" : ""}>${w}</option>`).join("")}
            </select>
            <label style="margin-top:8px"><input type="checkbox" id="homeAdv" ${config.venue.homeAdvantage ? "checked" : ""} /> Home advantage</label>
          </section>
        </div>

        <button class="btn" id="save" style="width:100%;margin-top:16px">Save & Continue</button>
        <button class="btn btn--ghost" id="eraLab" style="width:100%;margin-top:8px">Open Era Lab</button>
      </div>`;

    root.querySelector("#back")?.addEventListener("click", () => navigate("draftballer", returnRoute.replace("draftballer/", "")));
    root.querySelector("#realistic")?.addEventListener("change", (e) => {
      config.simulationMode = (e.target as HTMLInputElement).checked ? "realistic" : "prime_powers";
    });
    root.querySelector("#eraMode")?.addEventListener("change", (e) => {
      config.eraContext.mode = (e.target as HTMLSelectElement).value as SimMatchConfig["eraContext"]["mode"];
    });
    root.querySelector("#eraProfile")?.addEventListener("change", (e) => {
      config.eraContext.profileId = (e.target as HTMLSelectElement).value;
      config.eraContext.mode = "custom";
    });
    root.querySelector("#identity")?.addEventListener("change", (e) => {
      config.tacticalIdentityHome = (e.target as HTMLSelectElement).value as SimMatchConfig["tacticalIdentityHome"];
    });
    root.querySelector("#formation")?.addEventListener("change", (e) => {
      config.formationHomeId = (e.target as HTMLSelectElement).value;
    });
    root.querySelector("#weather")?.addEventListener("change", (e) => {
      config.weather = (e.target as HTMLSelectElement).value as SimMatchConfig["weather"];
    });
    root.querySelector("#homeAdv")?.addEventListener("change", (e) => {
      config.venue.homeAdvantage = (e.target as HTMLInputElement).checked;
    });
    root.querySelector("#save")?.addEventListener("click", () => {
      saveSimConfig(config);
      navigate("draftballer", returnRoute.replace("draftballer/", ""));
    });
    root.querySelector("#eraLab")?.addEventListener("click", () => {
      saveSimConfig(config);
      navigate("draftballer", "era-lab");
    });
  }

  draw();
}

export { renderFitReportHtml } from "./draftballer-reports.js";
