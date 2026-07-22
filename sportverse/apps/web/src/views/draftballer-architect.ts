import type { DraftFormat, DraftModeConfig } from "@sportverse/draftballer-types";
import {
  PRESET_MODES,
  buildDraftPool,
  encodeModeShare,
  modeShareUrl,
  poolSummary,
  decodeModeShare,
  listWheelFormationIds,
} from "@sportverse/draftballer-core";
import { lensBlend, setAwardsData } from "@sportverse/rating-engine";
import { getAwards, getIconicMoments } from "@sportverse/sports-db";
import { playerCardHtml } from "./draftballer-hub.js";
import { renderDraftballerWheel } from "./draftballer-wheel.js";
import { bindEliteMotion } from "../lib/elite-motion.js";

type Navigate = (route: string, param?: string) => void;

const FORMATION_CHIPS = ["4-4-2", "4-3-3", "3-5-2", "4-2-3-1", "5-3-2", "4-1-4-1"] as const;

const ERA_CHIPS: { id: string; label: string; sub: string; apply: (m: DraftModeConfig) => DraftModeConfig }[] = [
  {
    id: "modern",
    label: "Modern",
    sub: "2010+",
    apply: (m) => ({ ...m, era: "decade", decade: "2020s" }),
  },
  {
    id: "90s",
    label: "Classic 90s",
    sub: "1990–2005",
    apply: (m) => ({ ...m, era: "decade", decade: "1990s" }),
  },
  {
    id: "golden",
    label: "Golden Age",
    sub: "1960–1980",
    apply: (m) => ({ ...m, era: "custom_range", yearFrom: 1960, yearTo: 1980 }),
  },
  {
    id: "all_time",
    label: "All-Time",
    sub: "Peak-4",
    apply: (m) => ({ ...m, era: "all_time", decade: undefined, yearFrom: undefined, yearTo: undefined }),
  },
];

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function activeEraChip(mode: DraftModeConfig): string {
  if (mode.era === "all_time") return "all_time";
  if (mode.era === "decade" && mode.decade === "1990s") return "90s";
  if (mode.era === "custom_range") return "golden";
  return "modern";
}

function challengeFromState(minApps: number, legendsOnly: boolean): number {
  if (legendsOnly || minApps >= 80) return 100;
  if (minApps >= 35) return 50;
  return 0;
}

function applyChallenge(level: number): { minApps: number; legendsOnly: boolean; difficulty: DraftModeConfig["difficulty"] } {
  if (level >= 75) return { minApps: 80, legendsOnly: true, difficulty: "hard" };
  if (level >= 25) return { minApps: 40, legendsOnly: false, difficulty: "normal" };
  return { minApps: 0, legendsOnly: false, difficulty: "easy" };
}

function synergyMultiplier(avgOvr: number): string {
  const mult = Math.max(1, Math.min(2, 1 + (avgOvr - 65) / 45));
  return `x${mult.toFixed(2)}`;
}

function forecastPitchHtml(formationId: string): string {
  const fid = formationId || "4-3-3";
  return `
    <div class="db-byo-forecast-pitch" aria-hidden="true">
      <div class="db-byo-forecast-pitch__box">
        <div class="db-byo-forecast-pitch__inner">
          <div class="db-byo-forecast-pitch__line"></div>
          <div class="db-byo-forecast-pitch__circle"></div>
          <span class="db-byo-forecast-pitch__slot db-byo-forecast-pitch__slot--att">ST</span>
          <span class="db-byo-forecast-pitch__slot db-byo-forecast-pitch__slot--gk">GK</span>
        </div>
      </div>
      <span class="db-byo-forecast-pitch__label">${escapeHtml(fid)}</span>
    </div>`;
}

export function renderDraftballerArchitect(root: HTMLElement, navigate: Navigate) {
  let mode: DraftModeConfig = { ...PRESET_MODES.find((m) => m.id === "custom")!, formationId: "4-3-3" };
  let minApps = 0;
  let nationality = "";
  let legendsOnly = false;
  let deepCuts = mode.deepCuts ?? false;
  let primeYearsOnly = false;
  let positionLocked = false;
  let yearFrom = 1990;
  let yearTo = 2024;
  let selectedLeagues = ["premier-league", "la-liga"];
  let draftFormat: DraftFormat = (sessionStorage.getItem("db_mp_format") as DraftFormat) ?? "snake";
  let advancedOpen = false;
  let preview = poolSummary(
    buildDraftPool(mode, {
      minAppearances: minApps,
      nationality: nationality || undefined,
      legendsOnly,
    }),
  );

  setAwardsData(getAwards(), getIconicMoments());

  const allFormations = listWheelFormationIds();
  const formationOptions = FORMATION_CHIPS.filter((f) => allFormations.includes(f));

  function draw() {
    const formationId = mode.formationId ?? "4-3-3";
    const eraActive = activeEraChip(mode);
    const challenge = challengeFromState(minApps, legendsOnly);
    const challengeHint =
      challenge >= 75
        ? "Ballon d'Or difficulty raises elite spawn rate but shrinks draft capital."
        : challenge >= 25
          ? "World Class difficulty increases elite spawn rate but reduces draft capital by 15%."
          : "Squad difficulty — broad pool, forgiving picks.";

    root.innerHTML = `
      <div class="shell db-root db-byo-page">
        <button class="btn btn--ghost db-byo-back" id="back">← Modes</button>

        <header class="db-byo-header">
          <div class="db-byo-status">
            <span class="db-byo-status__dot" aria-hidden="true"></span>
            <span class="db-label-caps">Technical Lab / V2.4</span>
          </div>
          <h1 class="db-byo-title">Architect Your Draft</h1>
          <p class="db-byo-lede">Configure the operational parameters for your next recruitment sequence. Precision settings required for elite squad synergy.</p>
        </header>

        <div class="db-byo-grid">
          <section class="db-glass db-byo-panel">
            <div class="db-byo-panel__head">
              <span class="db-byo-panel__icon" aria-hidden="true">▦</span>
              <span class="db-label-caps">Formation Matrix</span>
              <span class="db-byo-panel__value">${escapeHtml(formationId)}</span>
            </div>
            <div class="db-byo-chip-grid">
              ${formationOptions
                .map(
                  (f) =>
                    `<button type="button" class="db-byo-chip ${formationId === f ? "db-byo-chip--active" : ""}" data-formation="${f}">${f}</button>`,
                )
                .join("")}
            </div>
          </section>

          <section class="db-glass db-byo-panel">
            <div class="db-byo-panel__head">
              <span class="db-byo-panel__icon" aria-hidden="true">◷</span>
              <span class="db-label-caps">Historical Era</span>
              <span class="db-byo-panel__value">${escapeHtml(ERA_CHIPS.find((e) => e.id === eraActive)?.sub ?? "Custom")}</span>
            </div>
            <div class="db-byo-era-rows">
              ${ERA_CHIPS.slice(0, 2)
                .map(
                  (e) =>
                    `<button type="button" class="db-byo-chip db-byo-chip--wide ${eraActive === e.id ? "db-byo-chip--active" : ""}" data-era="${e.id}">${e.label}</button>`,
                )
                .join("")}
            </div>
            <div class="db-byo-era-rows">
              ${ERA_CHIPS.slice(2)
                .map(
                  (e) =>
                    `<button type="button" class="db-byo-chip db-byo-chip--wide ${eraActive === e.id ? "db-byo-chip--active" : ""}" data-era="${e.id}">${e.label}</button>`,
                )
                .join("")}
            </div>
          </section>

          <section class="db-glass db-byo-panel">
            <div class="db-byo-panel__head">
              <span class="db-byo-panel__icon" aria-hidden="true">⇄</span>
              <span class="db-label-caps">Selection Logic</span>
            </div>
            <div class="db-byo-logic-list">
              <label class="db-byo-logic ${draftFormat === "snake" ? "db-byo-logic--active" : ""}">
                <input type="radio" name="draft-format" value="snake" ${draftFormat === "snake" ? "checked" : ""} hidden />
                <div>
                  <strong>Snake Draft</strong>
                  <span>Balanced turn-order logic</span>
                </div>
                <span class="db-byo-logic__radio" aria-hidden="true"></span>
              </label>
              <label class="db-byo-logic ${draftFormat === "linear" ? "db-byo-logic--active" : ""}">
                <input type="radio" name="draft-format" value="linear" ${draftFormat === "linear" ? "checked" : ""} hidden />
                <div>
                  <strong>Linear</strong>
                  <span>Sequential selection hierarchy</span>
                </div>
                <span class="db-byo-logic__radio" aria-hidden="true"></span>
              </label>
            </div>
          </section>

          <section class="db-glass db-byo-panel db-byo-panel--challenge">
            <div class="db-byo-panel__head">
              <span class="db-byo-panel__icon" aria-hidden="true">↗</span>
              <span class="db-label-caps">Challenge Rating</span>
            </div>
            <div class="db-byo-slider-wrap">
              <input type="range" id="challenge" class="db-byo-slider" min="0" max="100" step="50" value="${challenge}" />
              <div class="db-byo-slider-ticks">
                <div><span></span><em>Squad</em></div>
                <div class="db-byo-slider-ticks__mid"><span></span><em>World Class</em></div>
                <div><span></span><em>Ballon D'Or</em></div>
              </div>
            </div>
            <div class="db-byo-hint db-glass">
              <span aria-hidden="true">ℹ</span>
              <p>${escapeHtml(challengeHint)}</p>
            </div>
          </section>
        </div>

        <section class="db-glass db-byo-forecast">
          <div class="db-byo-forecast__inner">
            ${forecastPitchHtml(formationId)}
            <div class="db-byo-forecast__stats">
              <h3>Architecture Forecast</h3>
              <div class="db-byo-forecast__row">
                <span>Draft Pool Depth</span>
                <strong>${preview.count.toLocaleString()} Players</strong>
              </div>
              <div class="db-byo-forecast__line"></div>
              <div class="db-byo-forecast__row">
                <span>Synergy Multiplier</span>
                <strong>${synergyMultiplier(preview.avgOvr)}</strong>
              </div>
              <div class="db-byo-forecast__line"></div>
              <div class="db-byo-forecast__row">
                <span>Estimated Rounds</span>
                <strong>11</strong>
              </div>
              <div class="db-byo-forecast__line"></div>
              <div class="db-byo-forecast__row">
                <span>Avg OVR</span>
                <strong>${preview.avgOvr || "—"}</strong>
              </div>
            </div>
          </div>
        </section>

        <details class="db-byo-advanced" ${advancedOpen ? "open" : ""}>
          <summary class="db-label-caps">Advanced parameters</summary>
          <div class="db-byo-advanced__body">
            <div class="db-architect-grid">
              <section class="panel db-architect-panel">
                <h2>Era (fine tune)</h2>
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
                <input type="range" id="blend" min="0" max="100" value="${Math.round(mode.blendFactor * 100)}" ${mode.ratingLens === "blended" ? "" : "disabled"} />
                <p style="font-size:0.75rem;color:var(--db-muted);margin:4px 0 0">
                  ${
                    mode.ratingLens === "blended"
                      ? "Slider sets blend weight between club and international raws."
                      : `${mode.ratingLens.replace(/_/g, " ")} ignores blend — select Blended to use the slider.`
                  }
                </p>
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
                <label style="margin-top:8px;display:flex;align-items:center;gap:8px;cursor:pointer">
                  <input type="checkbox" id="deep-cuts" ${deepCuts ? "checked" : ""} />
                  Deep cuts (include fabricated / low-confidence players)
                </label>
                ${
                  preview.top[0]
                    ? (() => {
                        const card = preview.top[0]!;
                        const live = lensBlend(
                          card.breakdown.clubOvrRaw,
                          card.breakdown.intlOvrRaw,
                          mode.ratingLens,
                          mode.blendFactor,
                        );
                        return `<div class="db-live-blend" style="margin-top:12px;padding-top:10px;border-top:1px solid var(--db-border)">
                          <p class="db-stat-label">Live blend preview</p>
                          <p style="margin:4px 0"><strong>${card.name}</strong> · instant OVR <strong style="color:var(--db-gold)" data-live-blend-ovr>${live}</strong></p>
                          <p style="font-size:0.75rem;color:var(--db-muted)">Club ${card.breakdown.clubOvrRaw} · Intl ${card.breakdown.intlOvrRaw}</p>
                        </div>`;
                      })()
                    : ""
                }
              </section>
            </div>

            <div class="panel db-byo-pool-preview">
              <div class="db-pool-grid">${preview.top.slice(0, 6).map((c) => playerCardHtml(c, true)).join("")}</div>
              <div class="db-byo-secondary-actions">
                <button class="btn btn--ghost" id="start" type="button">${draftFormat === "linear" ? "Linear" : "Snake"} Draft vs Bot</button>
                <button class="btn btn--ghost" id="start-mp" type="button">Multiplayer Lobby</button>
                <button class="btn btn--ghost" id="share-mode" type="button">Copy preset share code</button>
              </div>
            </div>
          </div>
        </details>

        <div class="db-byo-cta">
          <button class="db-btn-pitch db-byo-init" id="start-wheel" type="button">
            <span aria-hidden="true">⚡</span>
            Initialize Draft
            <span aria-hidden="true">→</span>
          </button>
          <p class="db-byo-ready">
            <span class="db-byo-status__dot" aria-hidden="true"></span>
            <span class="db-label-caps">Systems Ready · Sequence Armed</span>
          </p>
        </div>
      </div>`;

    bindEvents();
    const pageRoot = root.querySelector(".db-root") as HTMLElement | null;
    if (pageRoot) bindEliteMotion(pageRoot, { scan: "wash" });
  }

  function bindEvents() {
    advancedOpen = root.querySelector(".db-byo-advanced")?.hasAttribute("open") ?? false;

    root.querySelector("#back")?.addEventListener("click", () => navigate("draftballer"));

    const update = () => {
      mode = {
        ...mode,
        deepCuts,
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

    root.querySelectorAll<HTMLElement>("[data-formation]").forEach((btn) => {
      btn.addEventListener("click", () => {
        mode = { ...mode, formationId: btn.dataset.formation };
        update();
      });
    });

    root.querySelectorAll<HTMLElement>("[data-era]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const chip = ERA_CHIPS.find((e) => e.id === btn.dataset.era);
        if (chip) {
          mode = chip.apply(mode);
          update();
        }
      });
    });

    root.querySelectorAll<HTMLInputElement>('input[name="draft-format"]').forEach((input) => {
      input.addEventListener("change", () => {
        draftFormat = input.value as DraftFormat;
        sessionStorage.setItem("db_mp_format", draftFormat);
        draw();
      });
    });

    root.querySelector("#challenge")?.addEventListener("input", (e) => {
      const level = Number((e.target as HTMLInputElement).value);
      const next = applyChallenge(level);
      minApps = next.minApps;
      legendsOnly = next.legendsOnly;
      mode = { ...mode, difficulty: next.difficulty };
      update();
    });

    root.querySelector("#blend")?.addEventListener("input", (e) => {
      if (mode.ratingLens !== "blended") return;
      mode = { ...mode, blendFactor: Number((e.target as HTMLInputElement).value) / 100 };
      update();
    });
    root.querySelector("#lens")?.addEventListener("change", (e) => {
      const ratingLens = (e.target as HTMLSelectElement).value as DraftModeConfig["ratingLens"];
      const blendFactor =
        ratingLens === "club_only" ? 0 : ratingLens === "international_only" ? 1 : mode.blendFactor;
      mode = { ...mode, ratingLens, blendFactor };
      update();
    });
    root.querySelector("#raw-domestic")?.addEventListener("change", (e) => {
      mode = { ...mode, rawDomesticDominance: (e.target as HTMLInputElement).checked };
      update();
    });
    root.querySelector("#deep-cuts")?.addEventListener("change", (e) => {
      deepCuts = (e.target as HTMLInputElement).checked;
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
      sessionStorage.setItem("db_mp_format", draftFormat);
      navigate("draftballer", draftFormat === "linear" ? "room/linear" : "room");
    });
    root.querySelector("#start-mp")?.addEventListener("click", () => {
      sessionStorage.setItem("db_mode", JSON.stringify(mode));
      sessionStorage.setItem("db_mp_format", draftFormat);
      navigate("draftballer", "mp-lobby");
    });
    root.querySelector("#share-mode")?.addEventListener("click", async () => {
      const code = encodeModeShare(mode);
      const url = modeShareUrl(code);
      try {
        await navigator.clipboard.writeText(url);
        (root.querySelector("#share-mode") as HTMLButtonElement).textContent = "Copied share link!";
      } catch {
        prompt("Copy this preset link:", url);
      }
    });
  }

  draw();
}

export function renderDraftballerQuick(root: HTMLElement, modeId: string, navigate: Navigate) {
  const mode = PRESET_MODES.find((m) => m.id === modeId) ?? PRESET_MODES[0]!;
  sessionStorage.setItem("db_mode", JSON.stringify(mode));
  renderDraftballerWheel(root, navigate);
}

/** Import Architect preset from `#/draftballer/mode-code/:code`. */
export function renderDraftballerModeCode(root: HTMLElement, code: string, navigate: Navigate) {
  try {
    const mode = decodeModeShare(code);
    sessionStorage.setItem("db_mode", JSON.stringify(mode));
    root.innerHTML = `
      <div class="shell db-root">
        <p class="db-hero__label">Preset imported</p>
        <h1 class="db-hero__title">${mode.title}</h1>
        <p style="color:var(--db-muted)">${mode.blurb}</p>
        <button class="btn" id="wheel">Spin & Build</button>
        <button class="btn btn--ghost" id="architect">Open in Architect</button>
        <button class="btn btn--ghost" id="hub">Hub</button>
      </div>`;
    root.querySelector("#wheel")?.addEventListener("click", () => navigate("draftballer", "wheel"));
    root.querySelector("#architect")?.addEventListener("click", () => navigate("draftballer", "architect"));
    root.querySelector("#hub")?.addEventListener("click", () => navigate("draftballer"));
  } catch {
    root.innerHTML = `
      <div class="shell db-root">
        <p class="db-hero__label">Invalid preset code</p>
        <button class="btn" id="hub">Hub</button>
      </div>`;
    root.querySelector("#hub")?.addEventListener("click", () => navigate("draftballer"));
  }
}
