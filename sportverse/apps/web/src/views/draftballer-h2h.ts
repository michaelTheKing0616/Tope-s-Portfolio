import {
  buildDraftPool,
  getPresetMode,
  loadSimConfig,
  loadSquadBuilderState,
  loadSquadForSeason,
} from "@sportverse/draftballer-core";
import { generateOpponents, simulateMatchV2 } from "@sportverse/match-sim";
import { renderFitReportHtml } from "./draftballer-sim-setup.js";

type Navigate = (route: string, param?: string) => void;

function buildSimConfig(saved: NonNullable<ReturnType<typeof loadSquadForSeason>>) {
  const config = loadSimConfig();
  const builder = loadSquadBuilderState();
  return {
    ...config,
    formationHomeId: saved.formationId ?? builder.formationId ?? config.formationHomeId,
    tacticalIdentityHome: saved.tacticalIdentity ?? builder.tacticalIdentity ?? config.tacticalIdentityHome,
  };
}

export function renderDraftballerH2h(root: HTMLElement, navigate: Navigate) {
  const saved = loadSquadForSeason();
  if (!saved?.players.length) {
    root.innerHTML = `
      <div class="shell db-root">
        <p class="db-hero__label">No squad saved</p>
        <p style="color:var(--db-muted)">Complete a draft first.</p>
        <button class="btn" id="hub">DRAFTBALLER Hub</button>
      </div>`;
    root.querySelector("#hub")?.addEventListener("click", () => navigate("draftballer"));
    return;
  }

  const mode = saved.mode ?? getPresetMode("all-time-any");
  const rivalPool = buildDraftPool(mode);
  const seed = `h2h_${Date.now()}`;
  const simConfig = buildSimConfig(saved);
  const userSquad = {
    name: saved.mode.title ?? "Your XI",
    playerIds: saved.playerIds,
    players: saved.players,
    squadOvr: saved.squadOvr,
    formationId: simConfig.formationHomeId,
    tacticalIdentity: simConfig.tacticalIdentityHome,
    draftMode: saved.mode,
  };
  const [rival] = generateOpponents(userSquad, 1, seed, rivalPool);
  const match = simulateMatchV2(userSquad, rival!, seed, 1, { config: simConfig });

  root.innerHTML = `
    <div class="shell db-root db-season-page">
      <button class="btn btn--ghost" id="back">← Season</button>
      <header class="db-hero">
        <p class="db-hero__label">Instant H2H · ${match.simulationMode === "realistic" ? match.eraProfileId : "Prime Powers"}</p>
        <p class="db-season-hero">${match.homeGoals} — ${match.awayGoals}</p>
        <p class="db-season-tagline">${userSquad.name} vs ${rival!.name}</p>
        ${match.preMatchHeadline ? `<p class="db-hero__sub">${match.preMatchHeadline}</p>` : ""}
      </header>
      <div class="panel">
        <strong>Match events</strong>
        <ul class="db-commentary-list">
          ${match.events
            .filter((e) => ["goal", "fulltime", "card_red", "penalty_goal", "penalty_miss"].includes(e.type))
            .map((e) => `<li>${e.text}</li>`)
            .join("")}
        </ul>
      </div>
      ${renderFitReportHtml(match.fitReport, match.simulationMode === "realistic" ? "Post-match fit report" : "")}
      <div class="db-season-actions">
        <button class="btn" id="rematch">Rematch</button>
        <button class="btn btn--ghost" id="setup">Simulation setup</button>
        <button class="btn btn--ghost" id="season">Season results</button>
      </div>
    </div>`;

  root.querySelector("#back")?.addEventListener("click", () => navigate("draftballer", "season"));
  root.querySelector("#rematch")?.addEventListener("click", () => renderDraftballerH2h(root, navigate));
  root.querySelector("#setup")?.addEventListener("click", () => navigate("draftballer", "sim-setup"));
  root.querySelector("#season")?.addEventListener("click", () => navigate("draftballer", "season"));
}
