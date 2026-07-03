import type { SeasonSimResult } from "@sportverse/draftballer-types";
import {
  buildDraftPool,
  loadSimConfig,
  loadSquadBuilderState,
  loadSquadForSeason,
  recordSeasonTrophies,
} from "@sportverse/draftballer-core";
import {
  generateOpponents,
  predictSeasonOutlook,
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
  const seed = `season_${saved.mode.id}_${saved.playerIds.join("-")}`;
  const config = loadSimConfig();
  const builder = loadSquadBuilderState();
  const simConfig = {
    ...config,
    formationHomeId: saved.formationId ?? builder.formationId ?? config.formationHomeId,
    tacticalIdentityHome: saved.tacticalIdentity ?? builder.tacticalIdentity ?? config.tacticalIdentityHome,
  };
  const userSquad = {
    name: saved.mode.title ?? "Your XI",
    playerIds: saved.playerIds,
    players: saved.players,
    squadOvr: saved.squadOvr,
    formationId: simConfig.formationHomeId,
    tacticalIdentity: simConfig.tacticalIdentityHome,
    draftMode: saved.mode,
  };

  const allOpponents = generateOpponents(userSquad, 38, seed, rivalPool);
  const opponentAvgOvr =
    allOpponents.length > 0
      ? Math.round(allOpponents.reduce((s, o) => s + o.squadOvr, 0) / allOpponents.length)
      : 72;
  const preview = predictSeasonOutlook(userSquad, opponentAvgOvr);

  let result: SeasonSimResult | null = null;
  let simRunning = false;

  function drawPreSim() {
    root.innerHTML = `
      <div class="shell db-root db-season-page">
        <button class="btn btn--ghost" id="back">← Hub</button>
        <header class="db-hero">
          <p class="db-hero__label">${saved.mode.title} · Season Preview</p>
          <h1 class="db-hero__title">Before the whistle blows</h1>
          <p class="db-hero__sub">Read the layman's take first — then run the full 38-game simulation with era fit, tactics, fatigue, and Dixon–Coles match modelling.</p>
        </header>

        ${renderSeasonPredictionHtml(preview)}

        <div class="panel db-report">
          <p class="db-hero__label">Simulation setup</p>
          <ul class="db-report__bullets">
            <li><strong>Mode:</strong> ${simConfig.simulationMode === "realistic" ? `Realistic (${simConfig.eraContext.profileId ?? "modern"} era)` : "Prime Powers (raw OVR)"}</li>
            <li><strong>Formation:</strong> ${simConfig.formationHomeId} · ${simConfig.tacticalIdentityHome.replace("_", " ")}</li>
            <li><strong>Squad OVR:</strong> ${saved.squadOvr} · ${saved.players.length} players drafted</li>
          </ul>
        </div>

        <div class="db-season-actions">
          <button class="btn db-season-sim-btn" id="runSim" ${simRunning ? "disabled" : ""}>
            ${simRunning ? "Simulating…" : "Run 38-game season simulation"}
          </button>
          <button class="btn btn--ghost" id="setup">Adjust sim conditions</button>
          <button class="btn btn--ghost" id="squad">Squad builder</button>
        </div>
      </div>`;

    root.querySelector("#back")?.addEventListener("click", () => navigate("draftballer"));
    root.querySelector("#setup")?.addEventListener("click", () => navigate("draftballer", "sim-setup"));
    root.querySelector("#squad")?.addEventListener("click", () => navigate("draftballer", "squad-builder"));
    root.querySelector("#runSim")?.addEventListener("click", () => {
      if (simRunning) return;
      simRunning = true;
      drawPreSim();
      setTimeout(() => {
        result = simulateSeason(userSquad, seed, { rivalPool, config: simConfig });
        recordSeasonTrophies(result, saved.mode.title ?? "Season");
        drawPostSim();
      }, 0);
    });
  }

  function drawPostSim() {
    if (!result) return;

    const [sampleOpp] = generateOpponents(userSquad, 1, `${seed}:sample`, rivalPool);
    const sampleMatch = simulateMatchV2(userSquad, sampleOpp!, `${seed}:sample`, 1, { config: simConfig });
    const highlightFixtures = result.fixtures.filter((f) => f.result === "L" || f.goalsFor >= 3).slice(0, 8);
    const mvp = saved.players.find((p) => p.playerId === result!.mvpPlayerId);

    root.innerHTML = `
      <div class="shell db-root db-season-page">
        <button class="btn btn--ghost" id="back">← Hub</button>
        <header class="db-hero">
          <p class="db-hero__label">${saved.mode.title} · Season Complete</p>
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

        ${
          mvp
            ? `<div class="panel db-mvp-panel">
                <p class="db-hero__label">Season MVP</p>
                ${playerCardHtml(mvp, true)}
              </div>`
            : ""
        }

        ${renderFitReportHtml(sampleMatch.fitReport, sampleMatch.preMatchHeadline ?? "Representative match fit (MD1 sample)")}

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
          <button class="btn" id="share">Share result</button>
          <button class="btn btn--ghost" id="again">Simulate again</button>
          <button class="btn btn--ghost" id="h2h">Instant H2H</button>
          <button class="btn btn--ghost" id="mini">Mini league</button>
        </div>
      </div>`;

    bindPlayerCardBreakdownsWithPool(root, rivalPool);
    root.querySelector("#back")?.addEventListener("click", () => navigate("draftballer"));
    root.querySelector("#again")?.addEventListener("click", () => {
      result = null;
      simRunning = false;
      drawPreSim();
    });
    root.querySelector("#h2h")?.addEventListener("click", () => navigate("draftballer", "h2h"));
    root.querySelector("#mini")?.addEventListener("click", () => navigate("draftballer", "mini-league"));
    root.querySelector("#share")?.addEventListener("click", async () => {
      const url = buildShareCardDataUrl(
        result!,
        saved.mode.title ?? "Season",
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
