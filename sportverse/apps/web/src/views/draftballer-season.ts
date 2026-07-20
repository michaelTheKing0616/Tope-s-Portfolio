import type { SeasonSimResult, SimMatchConfig } from "@sportverse/draftballer-types";
import {
  buildDraftPool,
  loadSimConfig,
  loadSquadBuilderState,
  loadSquadForSeason,
  patchSquadSimConditions,
  recordSeasonProgress,
  recordSeasonTrophies,
  saveSimConfig,
} from "@sportverse/draftballer-core";
import {
  fitPreviewHeadline,
  generateOpponents,
  getEraProfile,
  listEraProfiles,
  predictSeasonOutlook,
  resolveEraProfile,
  simulateMatchV2,
  simulateSeason,
} from "@sportverse/match-sim";
import { bindPlayerCardBreakdownsWithPool } from "./draftballer-breakdown.js";
import { buildShareCardDataUrl } from "./draftballer-share.js";
import { playerCardHtml } from "./draftballer-hub.js";
import {
  renderExpectationGradeHtml,
  renderFitReportHtml,
  renderSeasonAnalysisHtml,
  renderSeasonPredictionHtml,
} from "./draftballer-reports.js";

type Navigate = (route: string, param?: string) => void;

function resultBadge(result: "W" | "D" | "L"): string {
  const cls =
    result === "W" ? "db-fixture--win" : result === "L" ? "db-fixture--loss" : "db-fixture--draw";
  return `<span class="db-fixture-badge ${cls}">${result}</span>`;
}

function seasonHero(result: SeasonSimResult): string {
  if (result.isPerfect) {
    return `
      <p class="db-season-hero db-season-hero--perfect">38 — 0 — 0</p>
      <p class="db-season-tagline">Perfect season. Legendary.</p>`;
  }
  if (result.isUnbeaten) {
    return `
      <p class="db-season-hero">${result.won}W · ${result.drawn}D · ${result.lost}L</p>
      <p class="db-season-tagline">Unbeaten season — ${result.points} points</p>`;
  }
  return `
    <p class="db-season-hero">${result.won}W · ${result.drawn}D · ${result.lost}L</p>
    <p class="db-season-tagline">${result.points} pts · GD ${result.goalDifference >= 0 ? "+" : ""}${result.goalDifference}</p>`;
}

function draftEraProfileId(mode: { decade?: string; year?: number; era?: string }): string {
  if (mode.decade) {
    const map: Record<string, string> = {
      "1950s": "1950s-60s",
      "1960s": "1950s-60s",
      "1970s": "1970s-80s",
      "1980s": "1970s-80s",
      "1990s": "1990s",
      "2000s": "2000s",
      "2010s": "2010s",
      "2020s": "2020s",
    };
    return map[mode.decade] ?? "2020s";
  }
  if (mode.year != null) {
    const y = mode.year;
    if (y < 1970) return "1950s-60s";
    if (y < 1990) return "1970s-80s";
    if (y < 2000) return "1990s";
    if (y < 2010) return "2000s";
    if (y < 2020) return "2010s";
    return "2020s";
  }
  return "2020s";
}

type EraChoice = "match_draft" | "modern" | string;

export function renderDraftballerSeason(root: HTMLElement, navigate: Navigate) {
  const saved = loadSquadForSeason();
  if (!saved || !saved.players.length) {
    root.innerHTML = `
      <div class="shell db-root">
        <p class="db-hero__label">No squad saved</p>
        <p style="color:var(--db-muted)">Complete a draft first, then simulate your season.</p>
        <button class="btn" id="hub">DRAFTBALLER Hub</button>
      </div>`;
    root.querySelector("#hub")?.addEventListener("click", () => navigate("draftballer"));
    return;
  }

  const rivalPool = buildDraftPool(saved.mode);
  const draftSeed = saved.seed ?? `season_${saved.mode.id}_${saved.playerIds.join("-")}`;
  const config = loadSimConfig();
  const builder = loadSquadBuilderState();

  let eraChoice: EraChoice = "match_draft";
  if (saved.eraContext?.profileId === "2020s" && saved.eraContext.mode === "neutral_modern") {
    eraChoice = "modern";
  } else if (saved.eraContext?.profileId && saved.eraContext.mode === "custom") {
    eraChoice = saved.eraContext.profileId;
  } else if (config.eraContext.profileId && config.eraContext.mode === "custom") {
    eraChoice = config.eraContext.profileId;
  }

  let realisticFit = (saved.simulationMode ?? config.simulationMode) !== "prime_powers";

  function resolveEraContext(): SimMatchConfig["eraContext"] {
    if (eraChoice === "match_draft") {
      return {
        mode: "match_higher_draft",
        profileId: draftEraProfileId(saved.mode),
      };
    }
    if (eraChoice === "modern") {
      return { mode: "neutral_modern", profileId: "2020s" };
    }
    return { mode: "custom", profileId: eraChoice };
  }

  function buildSimConfig(): SimMatchConfig {
    return {
      ...config,
      simulationMode: realisticFit ? "realistic" : "prime_powers",
      eraContext: resolveEraContext(),
      formationHomeId: saved.formationId ?? builder.formationId ?? config.formationHomeId,
      tacticalIdentityHome:
        saved.tacticalIdentity ?? builder.tacticalIdentity ?? config.tacticalIdentityHome,
    };
  }

  function persistConditions(): void {
    const simConfig = buildSimConfig();
    patchSquadSimConditions({
      eraContext: simConfig.eraContext,
      simulationMode: simConfig.simulationMode,
      formationId: simConfig.formationHomeId,
      tacticalIdentity: simConfig.tacticalIdentityHome,
    });
    saveSimConfig(simConfig);
  }

  const userSquadBase = {
    name: saved.mode.title ?? "Your XI",
    playerIds: saved.playerIds,
    players: saved.players,
    squadOvr: saved.squadOvr,
    draftMode: saved.mode,
  };

  const previewOpponents = generateOpponents(
    { ...userSquadBase, formationId: buildSimConfig().formationHomeId },
    38,
    draftSeed,
    rivalPool,
  );
  const opponentAvgOvr =
    previewOpponents.length > 0
      ? Math.round(previewOpponents.reduce((s, o) => s + o.squadOvr, 0) / previewOpponents.length)
      : 72;
  const preview = predictSeasonOutlook(
    { ...userSquadBase, squadOvr: saved.squadOvr },
    opponentAvgOvr,
  );

  let result: SeasonSimResult | null = null;
  let simRunning = false;

  function drawPreSim() {
    const simConfig = buildSimConfig();
    const era = resolveEraProfile(simConfig.eraContext, saved.mode.decade);
    const fitLine =
      simConfig.simulationMode === "realistic"
        ? fitPreviewHeadline(saved.players, era)
        : "Prime Powers: pure base OVR — era fit disabled";

    const decadeOptions = listEraProfiles()
      .filter((p) => !p.id.includes("serie") && !p.id.includes("world-cup"))
      .map(
        (p) =>
          `<option value="${p.id}" ${eraChoice === p.id ? "selected" : ""}>${p.label}</option>`,
      )
      .join("");

    root.innerHTML = `
      <div class="shell db-root db-season-page">
        <button class="btn btn--ghost" id="back">← Hub</button>
        <header class="db-hero">
          <p class="db-hero__label">${saved.mode.title} · Season Preview</p>
          <h1 class="db-hero__title">Before the whistle blows</h1>
          <p class="db-hero__sub">Draft era ≠ simulation era. Set match conditions, then run the 38-game season.</p>
        </header>

        ${renderSeasonPredictionHtml(preview)}

        <div class="panel db-report db-match-conditions">
          <p class="db-hero__label">Match Conditions</p>
          <h2 class="db-report__title">Simulation era</h2>
          <label class="db-stat-label">Era context</label>
          <select id="eraChoice" class="btn btn--ghost btn--block">
            <option value="match_draft" ${eraChoice === "match_draft" ? "selected" : ""}>Match my draft era</option>
            <option value="modern" ${eraChoice === "modern" ? "selected" : ""}>Modern (2020s)</option>
            <optgroup label="Decade picker">
              ${decadeOptions}
            </optgroup>
          </select>
          <label class="db-stat-label" style="margin-top:12px;display:flex;gap:8px;align-items:center">
            <input type="checkbox" id="realisticFit" ${realisticFit ? "checked" : ""} />
            Realistic Era Fit (recommended)
          </label>
          <p style="font-size:0.8rem;color:var(--db-muted);margin:4px 0 0">Off = Prime Powers (pure base OVR, no era penalties)</p>
          <p class="db-fit-preview" style="margin-top:12px;color:var(--db-gold);font-size:0.95rem">${fitLine}</p>
          <ul class="db-report__bullets" style="margin-top:12px">
            <li><strong>Formation:</strong> ${simConfig.formationHomeId} · ${simConfig.tacticalIdentityHome.replace("_", " ")}</li>
            <li><strong>Squad OVR:</strong> ${saved.squadOvr} · ${saved.players.length} players drafted</li>
            <li><strong>Resolved era:</strong> ${era.label}</li>
          </ul>
        </div>

        <div class="db-season-actions">
          <button class="btn db-season-sim-btn" id="runSim" ${simRunning ? "disabled" : ""}>
            ${simRunning ? "Simulating…" : "Run 38-game season simulation"}
          </button>
          <button class="btn btn--ghost" id="setup">Full sim setup</button>
          <button class="btn btn--ghost" id="squad">Squad builder</button>
        </div>
      </div>`;

    root.querySelector("#back")?.addEventListener("click", () => navigate("draftballer"));
    root.querySelector("#setup")?.addEventListener("click", () => {
      persistConditions();
      navigate("draftballer", "sim-setup");
    });
    root.querySelector("#squad")?.addEventListener("click", () => navigate("draftballer", "squad-builder"));
    root.querySelector("#eraChoice")?.addEventListener("change", (e) => {
      eraChoice = (e.target as HTMLSelectElement).value as EraChoice;
      persistConditions();
      drawPreSim();
    });
    root.querySelector("#realisticFit")?.addEventListener("change", (e) => {
      realisticFit = (e.target as HTMLInputElement).checked;
      persistConditions();
      drawPreSim();
    });
    root.querySelector("#runSim")?.addEventListener("click", () => {
      if (simRunning) return;
      simRunning = true;
      persistConditions();
      drawPreSim();
      const simConfig = buildSimConfig();
      const userSquad = {
        ...userSquadBase,
        formationId: simConfig.formationHomeId,
        tacticalIdentity: simConfig.tacticalIdentityHome,
      };
      setTimeout(() => {
        result = simulateSeason(userSquad, draftSeed, { rivalPool, config: simConfig });
        recordSeasonTrophies(result, saved.mode.title ?? "Season");
        recordSeasonProgress(result);
        drawPostSim();
      }, 0);
    });
  }

  function drawPostSim() {
    if (!result) return;

    const simConfig = buildSimConfig();
    const era = getEraProfile(result.eraProfileId === "prime_powers" ? "2020s" : result.eraProfileId ?? "2020s");
    const [sampleOpp] = generateOpponents(
      { ...userSquadBase, formationId: simConfig.formationHomeId },
      1,
      `${result.seed}:sample`,
      rivalPool,
    );
    const sampleMatch = simulateMatchV2(
      { ...userSquadBase, formationId: simConfig.formationHomeId, tacticalIdentity: simConfig.tacticalIdentityHome },
      sampleOpp!,
      `${result.seed}:sample`,
      1,
      { config: simConfig },
    );
    const highlightFixtures = result.fixtures.filter((f) => f.result === "L" || f.goalsFor >= 3).slice(0, 8);
    const mvp = saved.players.find((p) => p.playerId === result!.mvpPlayerId);
    const fitReport = result.seasonFitReport?.length ? result.seasonFitReport : sampleMatch.fitReport;

    root.innerHTML = `
      <div class="shell db-root db-season-page">
        <button class="btn btn--ghost" id="back">← Hub</button>
        <header class="db-hero">
          <p class="db-hero__label">${saved.mode.title} · Season Complete · ${era.label}</p>
          ${seasonHero(result)}
          <p style="color:var(--db-muted);font-size:0.85rem">
            ${result.goalsFor} scored · ${result.goalsAgainst} conceded · Squad OVR ${saved.squadOvr}
          </p>
        </header>

        ${result.expectationGrade ? renderExpectationGradeHtml(result.expectationGrade) : ""}

        <div class="db-season-stats panel">
          <div><span class="db-stat-label">Played</span><strong>${result.played}</strong></div>
          <div><span class="db-stat-label">Points</span><strong style="color:var(--db-gold)">${result.points}</strong></div>
          <div><span class="db-stat-label">GF</span><strong>${result.goalsFor}</strong></div>
          <div><span class="db-stat-label">GA</span><strong>${result.goalsAgainst}</strong></div>
        </div>

        ${renderSeasonAnalysisHtml(result)}

        ${renderFitReportHtml(fitReport, `Season Fit Report · ${era.label}`)}

        ${
          mvp
            ? `<div class="panel db-mvp-panel">
                <p class="db-hero__label">Season MVP</p>
                ${playerCardHtml(mvp, true)}
                <button class="btn btn--ghost btn--block" id="mvp-compare" type="button" style="margin-top:10px">Compare contexts →</button>
              </div>`
            : ""
        }

        <div class="db-fixtures panel">
          <strong>All 38 fixtures</strong>
          <div class="db-fixture-list">
            ${result.fixtures
              .map(
                (f) => `
              <div class="db-fixture-row">
                <span class="db-fixture-md">MD${f.matchday}</span>
                ${resultBadge(f.result)}
                <span class="db-fixture-score">${f.home ? "" : "(A) "}${f.goalsFor}–${f.goalsAgainst}</span>
                <span class="db-fixture-opp">${f.opponent}</span>
              </div>`,
              )
              .join("")}
          </div>
        </div>

        ${
          highlightFixtures.length
            ? `<div class="panel db-report">
                <p class="db-hero__label">Key moments</p>
                <ul class="db-commentary-list">
                  ${highlightFixtures
                    .flatMap((f) =>
                      f.events
                        .filter((e) => e.type === "goal")
                        .map((e) => `<li>MD${f.matchday}: ${e.text}</li>`),
                    )
                    .join("")}
                </ul>
              </div>`
            : ""
        }

        <details class="panel db-report">
          <summary class="db-report__title" style="cursor:pointer">Pre-season preview (for reference)</summary>
          ${renderSeasonPredictionHtml(result.prediction ?? preview)}
        </details>

        <div class="db-season-actions">
          <button class="btn" id="share" type="button">Share</button>
          <button class="btn" id="runBack" type="button">Run It Back</button>
          <button class="btn btn--ghost" id="newDraft" type="button">New Draft</button>
          <details class="db-overflow-menu">
            <summary>More</summary>
            <div class="db-overflow-menu__body">
              <button class="btn btn--ghost btn--block" id="eraLab" type="button">Era Lab</button>
              <button class="btn btn--ghost btn--block" id="h2h" type="button">Instant H2H</button>
              <button class="btn btn--ghost btn--block" id="mini" type="button">Mini league</button>
            </div>
          </details>
        </div>
      </div>`;

    bindPlayerCardBreakdownsWithPool(root, rivalPool);
    root.querySelector("#back")?.addEventListener("click", () => navigate("draftballer"));
    root.querySelector("#mvp-compare")?.addEventListener("click", () => {
      if (mvp) navigate("draftballer", `compare/${mvp.playerId}`);
    });
    root.querySelector("#eraLab")?.addEventListener("click", () => {
      persistConditions();
      navigate("draftballer", "era-lab");
    });
    root.querySelector("#runBack")?.addEventListener("click", () => {
      // Same squad + seed — re-open Match Conditions (determinism preserved).
      result = null;
      simRunning = false;
      drawPreSim();
    });
    root.querySelector("#newDraft")?.addEventListener("click", () => navigate("draftballer", "wheel"));
    root.querySelector("#h2h")?.addEventListener("click", () => navigate("draftballer", "h2h"));
    root.querySelector("#mini")?.addEventListener("click", () => navigate("draftballer", "mini-league"));
    root.querySelector("#share")?.addEventListener("click", async () => {
      const url = buildShareCardDataUrl(
        result!,
        `${saved.mode.title ?? "Season"} · ${era.label}`,
        saved.squadOvr,
        result!.mvpPlayerName,
      );
      if (navigator.share) {
        const blob = await (await fetch(url)).blob();
        const file = new File([blob], "draftballer-season.png", { type: "image/png" });
        await navigator.share({ files: [file], title: "DRAFTBALLER Season" });
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = "draftballer-season.png";
        a.click();
      }
    });
  }

  drawPreSim();
}
