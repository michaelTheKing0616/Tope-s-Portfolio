import type { EraLabResult, EraLabResultRow } from "@sportverse/draftballer-types";
import {
  buildDraftPool,
  loadSimConfig,
  loadSquadForSeason,
} from "@sportverse/draftballer-core";
import { generateOpponents, simulateEraLab } from "@sportverse/match-sim";
import { buildEraLabShareDataUrl } from "./draftballer-share.js";
import { pitchSurfaceHtml } from "./draftballer-pitch.js";
import { bindEliteMotion } from "../lib/elite-motion.js";

type Navigate = (route: string, param?: string) => void;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function rowMetrics(row: EraLabResultRow) {
  const played = row.wins + row.draws + row.losses || 1;
  const winProb = Math.round((row.wins / played) * 100);
  const xg = (row.goalsFor / played).toFixed(2);
  const eraBonus = row.avgFitDelta >= 0 ? `+${row.avgFitDelta}` : `${row.avgFitDelta}`;
  const variance = (Math.abs(row.goalsFor - row.goalsAgainst) / played).toFixed(1);
  return { winProb, xg, eraBonus, variance };
}

function engineStability(rows: EraLabResultRow[]): string {
  const played = rows.reduce((s, r) => s + r.wins + r.draws + r.losses, 0);
  if (!played) return "99.00%";
  const draws = rows.reduce((s, r) => s + r.draws, 0);
  return `${(98 + (draws / played) * 2).toFixed(2)}%`;
}

function draftPower(squadOvr: number): number {
  return Math.round(squadOvr * 16.1);
}

function eraCardHtml(row: EraLabResultRow, idx: number, active: boolean): string {
  const meta = row.label.match(/\(([^)]+)\)/)?.[1] ?? row.eraProfileId;
  return `
    <button type="button" class="db-era-lab-era ${active ? "db-era-lab-era--active" : ""}" data-era-idx="${idx}">
      <div class="db-era-lab-era__head">
        <strong>${escapeHtml(row.label.replace(/\s*\([^)]*\)/, ""))}</strong>
        <span class="db-era-lab-mono">${escapeHtml(meta)}</span>
      </div>
      <p>${row.wins}-${row.draws}-${row.losses} · GF ${row.goalsFor} · fit ${row.avgFitDelta >= 0 ? "+" : ""}${row.avgFitDelta}</p>
    </button>`;
}

function analysisCardsHtml(result: EraLabResult, row: EraLabResultRow): string {
  const fit = result.highlightFit[0];
  const cards = [
    {
      icon: "◎",
      title: "Statistical Alignment",
      tag: "Metric Node 04-A",
      text: fit
        ? `${fit.playerName} projects ${fit.effectiveDelta >= 0 ? "+" : ""}${fit.effectiveDelta} fit delta in the ${row.label} profile.`
        : `Your roster averages ${row.avgFitDelta >= 0 ? "+" : ""}${row.avgFitDelta} fit delta across simulated fixtures in ${row.label}.`,
    },
    {
      icon: "⚖",
      title: "Era Compatibility",
      tag: "Engine Alpha-9",
      text:
        row.avgFitDelta >= 0
          ? `${row.label} rewards your squad's profile — ${row.wins} wins in ${row.wins + row.draws + row.losses} tests.`
          : `${row.label} may punish modern profiles — consider a more era-authentic spine (${row.losses} losses logged).`,
    },
    {
      icon: "◈",
      title: "Predictive Model",
      tag: "Data Cluster V2",
      text: `Calculated from ${(row.wins + row.draws + row.losses) * 3} match events per era slice — variance ${rowMetrics(row).variance} goals per game.`,
    },
  ];
  return cards
    .map(
      (c) => `
    <article class="db-glass db-era-lab-analysis">
      <div class="db-era-lab-analysis__head">
        <span class="db-era-lab-analysis__icon" aria-hidden="true">${c.icon}</span>
        <div>
          <h3>${c.title}</h3>
          <span class="db-label-caps">${c.tag}</span>
        </div>
      </div>
      <p>${escapeHtml(c.text)}</p>
    </article>`,
    )
    .join("");
}

function tacticalMatrixHtml(saved: NonNullable<ReturnType<typeof loadSquadForSeason>>, row: EraLabResultRow): string {
  const players = saved.players.slice(0, 5);
  const nodes = players
    .map((p, i) => {
      const positions = [
        { top: "22%", left: "22%" },
        { top: "22%", left: "78%" },
        { top: "48%", left: "50%" },
        { top: "72%", left: "32%" },
        { top: "72%", left: "68%" },
      ][i]!;
      return `<span class="db-era-lab-node" style="top:${positions.top};left:${positions.left}"><em>${p.ovr}</em><small>${p.position}</small></span>`;
    })
    .join("");

  const inner = `
    <div class="db-era-lab-pitch-inner">
      <div class="db-era-lab-pitch-mark"></div>
      <div class="db-era-lab-pitch-mark db-era-lab-pitch-mark--circle"></div>
      ${nodes}
      <div class="db-era-lab-holo db-era-lab-holo--def">
        <span>DEFENSE DEPTH</span>
        <strong>${(68 + row.avgFitDelta).toFixed(1)}m</strong>
      </div>
      <div class="db-era-lab-holo db-era-lab-holo--width">
        <span>WIDTH SPREAD</span>
        <strong>${(48 + row.wins * 2).toFixed(1)}m</strong>
      </div>
    </div>`;

  return pitchSurfaceHtml(inner, { className: "db-era-lab-pitch", flat: true, ariaLabel: "Tactical matrix" });
}

export function renderDraftballerEraLab(root: HTMLElement, navigate: Navigate) {
  const saved = loadSquadForSeason();
  if (!saved?.players.length) {
    root.innerHTML = `<div class="shell db-root"><p>No squad saved.</p><button class="btn" id="hub">Hub</button></div>`;
    root.querySelector("#hub")?.addEventListener("click", () => navigate("draftballer"));
    return;
  }

  let config = loadSimConfig();
  let highlightedIdx = 0;
  let result: EraLabResult;

  function runSimulation() {
    const pool = buildDraftPool(saved!.mode);
    const userSquad = {
      name: saved!.mode.title ?? "Your XI",
      playerIds: saved!.playerIds,
      players: saved!.players,
      squadOvr: saved!.squadOvr,
      formationId: saved!.formationId,
      draftMode: saved!.mode,
    };
    result = simulateEraLab(userSquad, `eralab_${saved!.seed ?? "local"}_${Date.now()}`, config, (_era, i) => {
      const [opp] = generateOpponents(userSquad, 1, `opp_${i}`, pool);
      return opp!;
    });
    highlightedIdx = result.rows.reduce(
      (best, r, i) => (r.wins > result.rows[best]!.wins ? i : best),
      0,
    );
  }

  runSimulation();

  function draw() {
    const row = result.rows[highlightedIdx] ?? result.rows[0]!;
    const metrics = rowMetrics(row);
    const stability = engineStability(result.rows);
    const power = draftPower(saved!.squadOvr);

    root.innerHTML = `
      <div class="shell db-root db-era-lab-page">
        <button class="btn btn--ghost" id="back">← Results</button>

        <header class="db-era-lab-hero">
          <div>
            <h1>Simulation Engine</h1>
            <p>Test ${escapeHtml(result.squadName)} against history's greatest archetypes. Adjust environmental parameters to calculate performance variance across football epochs.</p>
          </div>
          <div class="db-era-lab-chips">
            <div class="db-glass db-era-lab-chip">
              <span class="db-label-caps">Engine Stability</span>
              <strong class="db-era-lab-mono">${stability}</strong>
            </div>
            <div class="db-glass db-era-lab-chip db-era-lab-chip--accent">
              <span class="db-label-caps">Draft Power</span>
              <strong class="db-era-lab-mono">${power.toLocaleString()} <small>kW</small></strong>
            </div>
          </div>
        </header>

        <div class="db-era-lab-layout">
          <div class="db-era-lab-controls">
            <section class="db-glass db-era-lab-block">
              <header class="db-era-lab-block__head">
                <span class="db-label-caps">01. Era Selector</span>
              </header>
              <div class="db-era-lab-era-list">
                ${result.rows.map((r, i) => eraCardHtml(r, i, i === highlightedIdx)).join("")}
              </div>
            </section>

            <section class="db-glass db-era-lab-block">
              <header class="db-era-lab-block__head">
                <span class="db-label-caps">02. Variables</span>
              </header>
              <div class="db-era-lab-vars">
                <div class="db-era-lab-var">
                  <div class="db-era-lab-var__label">
                    <span>Fatigue Level</span>
                    <strong class="db-era-lab-mono">${Math.min(99, 30 + highlightedIdx * 8)}%</strong>
                  </div>
                  <input type="range" class="db-era-lab-slider" min="0" max="100" value="${30 + highlightedIdx * 8}" disabled />
                </div>
                <div class="db-era-lab-venue">
                  <button type="button" class="db-era-lab-venue-btn db-era-lab-venue-btn--active" disabled>Home</button>
                  <button type="button" class="db-era-lab-venue-btn" disabled>Away</button>
                </div>
                <div class="db-era-lab-toggle">
                  <span>Extreme Weather</span>
                  <span class="db-era-lab-toggle__switch" aria-hidden="true"></span>
                </div>
                <button type="button" class="btn btn--ghost btn--block" id="simSetup">Match conditions →</button>
              </div>
            </section>
          </div>

          <div class="db-era-lab-display">
            <section class="db-glass db-era-lab-matrix">
              <div class="db-era-lab-matrix__scan" aria-hidden="true"></div>
              <div class="db-era-lab-matrix__head">
                <div>
                  <span class="db-era-lab-live"><span></span> Live Simulation Ready</span>
                  <h2>Tactical Matrix</h2>
                </div>
                <div class="db-era-lab-latency">
                  <span class="db-label-caps">Latency</span>
                  <strong class="db-era-lab-mono">14ms</strong>
                </div>
              </div>
              ${tacticalMatrixHtml(saved!, row)}
              <div class="db-era-lab-metrics">
                <div class="db-glass db-era-lab-metric">
                  <span class="db-label-caps">Win Prob</span>
                  <strong class="db-era-lab-mono">${metrics.winProb}<small>%</small></strong>
                </div>
                <div class="db-glass db-era-lab-metric">
                  <span class="db-label-caps">xG Calc</span>
                  <strong class="db-era-lab-mono">${metrics.xg}</strong>
                </div>
                <div class="db-glass db-era-lab-metric">
                  <span class="db-label-caps">Era Bonus</span>
                  <strong class="db-era-lab-mono db-era-lab-mono--green">${metrics.eraBonus}</strong>
                </div>
                <div class="db-glass db-era-lab-metric">
                  <span class="db-label-caps">Variance</span>
                  <strong class="db-era-lab-mono">${metrics.variance}</strong>
                </div>
              </div>
            </section>

            <div class="db-era-lab-actions">
              <button class="db-btn-pitch db-era-lab-run" id="runSim" type="button" style="position:relative;overflow:hidden">
                <span class="db-era-lab-btn-scan" aria-hidden="true"></span>
                <span aria-hidden="true">⇄</span> Run Simulation
              </button>
              <button class="db-glass db-era-lab-save" id="shareEra" type="button" title="Share card">⬇</button>
            </div>
          </div>
        </div>

        <section class="db-era-lab-analysis-grid">${analysisCardsHtml(result, row)}</section>
      </div>`;

    bindEvents();
    const pageRoot = root.querySelector(".db-root") as HTMLElement | null;
    if (pageRoot) bindEliteMotion(pageRoot, { scan: "vscan" });
  }

  function bindEvents() {
    root.querySelector("#back")?.addEventListener("click", () => navigate("draftballer", "season"));
    root.querySelector("#simSetup")?.addEventListener("click", () => navigate("draftballer", "sim-setup"));
    root.querySelector("#runSim")?.addEventListener("click", () => {
      runSimulation();
      draw();
    });
    root.querySelectorAll<HTMLElement>("[data-era-idx]").forEach((btn) => {
      btn.addEventListener("click", () => {
        highlightedIdx = Number(btn.dataset.eraIdx);
        draw();
      });
    });
    root.querySelector("#shareEra")?.addEventListener("click", async () => {
      const url = buildEraLabShareDataUrl(result);
      if (!url) return;
      if (navigator.share) {
        const blob = await (await fetch(url)).blob();
        const file = new File([blob], "draftballer-era-lab.png", { type: "image/png" });
        await navigator.share({ files: [file], title: "DRAFTBALLER Era Lab" });
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = "draftballer-era-lab.png";
        a.click();
      }
    });
  }

  draw();
}
