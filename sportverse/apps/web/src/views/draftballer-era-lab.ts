import { buildDraftPool, loadSimConfig, loadSquadForSeason } from "@sportverse/draftballer-core";
import { generateOpponents, simulateEraLab } from "@sportverse/match-sim";
import { renderFitReportHtml } from "./draftballer-sim-setup.js";
import { buildEraLabShareDataUrl } from "./draftballer-share.js";

type Navigate = (route: string, param?: string) => void;

export function renderDraftballerEraLab(root: HTMLElement, navigate: Navigate) {
  const saved = loadSquadForSeason();
  if (!saved?.players.length) {
    root.innerHTML = `<div class="shell db-root"><p>No squad saved.</p><button class="btn" id="hub">Hub</button></div>`;
    root.querySelector("#hub")?.addEventListener("click", () => navigate("draftballer"));
    return;
  }

  const config = loadSimConfig();
  const pool = buildDraftPool(saved.mode);
  const userSquad = {
    name: saved.mode.title ?? "Your XI",
    playerIds: saved.playerIds,
    players: saved.players,
    squadOvr: saved.squadOvr,
    formationId: saved.formationId,
    draftMode: saved.mode,
  };

  const result = simulateEraLab(userSquad, `eralab_${saved.seed ?? "local"}`, config, (_era, i) => {
    const [opp] = generateOpponents(userSquad, 1, `opp_${i}`, pool);
    return opp!;
  });

  root.innerHTML = `
    <div class="shell db-root">
      <button class="btn btn--ghost" id="back">← Results</button>
      <header class="db-hero">
        <p class="db-hero__label">Era Lab</p>
        <h1 class="db-hero__title">${result.squadName}</h1>
        <p class="db-hero__sub">Win/loss record across every reference era profile (3 matches each)</p>
      </header>
      <div class="panel">
        <table class="db-era-table" style="width:100%;font-size:0.85rem;border-collapse:collapse">
          <thead><tr><th>Era</th><th>W-D-L</th><th>GF-GA</th><th>Avg fit Δ</th></tr></thead>
          <tbody>
            ${result.rows
              .map(
                (r) =>
                  `<tr><td>${r.label}</td><td>${r.wins}-${r.draws}-${r.losses}</td><td>${r.goalsFor}-${r.goalsAgainst}</td><td>${r.avgFitDelta >= 0 ? "+" : ""}${r.avgFitDelta}</td></tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>
      ${renderFitReportHtml(result.highlightFit, "Sample fit deltas (2020s baseline)")}
      <div class="db-season-actions">
        <button class="btn" id="shareEra">Share Era Lab card</button>
        <button class="btn btn--ghost" id="season">Back to season</button>
      </div>
    </div>`;

  root.querySelector("#back")?.addEventListener("click", () => navigate("draftballer", "season"));
  root.querySelector("#season")?.addEventListener("click", () => navigate("draftballer", "season"));
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
