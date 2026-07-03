import type { SimSquadInput } from "@sportverse/draftballer-types";
import { buildDraftPool, PRESET_MODES, loadSquadForSeason, encodeSquadShare, decodeSquadShare, loadSimConfig, loadSquadBuilderState } from "@sportverse/draftballer-core";
import { simulateKnockoutBracket, type KnockoutSquad } from "@sportverse/match-sim";

type Navigate = (route: string, param?: string) => void;

export function renderDraftballerUcl(root: HTMLElement, navigate: Navigate) {
  const mode = PRESET_MODES.find((m) => m.id === "continental-cl")!;
  const pool = buildDraftPool(mode).slice(0, 16);
  const squads: KnockoutSquad[] = [];

  for (let i = 0; i < 8; i++) {
    const slice = pool.slice(i * 11, i * 11 + 11);
    if (slice.length < 11) break;
    const sim: SimSquadInput = {
      name: `Seed ${i + 1}`,
      playerIds: slice.map((p) => p.playerId),
      players: slice,
      squadOvr: Math.round(slice.reduce((s, p) => s + p.ovr, 0) / slice.length),
    };
    squads.push({ id: `s${i}`, name: sim.name!, seed: i + 1, squad: sim });
  }

  const mySquad = loadSquadForSeason();
  if (mySquad?.players.length === 11) {
    squads.unshift({
      id: "you",
      name: "Your XI",
      seed: 0,
      squad: {
        name: "Your XI",
        playerIds: mySquad.playerIds,
        players: mySquad.players,
        squadOvr: mySquad.squadOvr,
      },
    });
  }

  let resultHtml = "";
  if (squads.length >= 2) {
    const simConfig = loadSimConfig();
    const builder = loadSquadBuilderState();
    const knockoutConfig = {
      ...simConfig,
      formationHomeId: mySquad?.formationId ?? builder.formationId ?? simConfig.formationHomeId,
      isKnockout: true,
    };
    const result = simulateKnockoutBracket(squads.slice(0, 8), `ucl-${Date.now()}`, {
      simConfig: knockoutConfig,
      twoLegged: true,
      twoLeggedFromRound: "Semi-Final",
    });
    resultHtml = `
      <p style="color:var(--db-gold);margin-top:12px">Champion: <strong>${result.champion.name}</strong></p>
      <ul style="color:var(--db-muted);font-size:0.85rem">
        ${result.bracket.map((b) => `<li>${b.round}: ${b.winners.join(" · ")}</li>`).join("")}
      </ul>`;
  }

  root.innerHTML = `
    <div class="shell db-root">
      <button class="btn btn--ghost" id="back">← Hub</button>
      <header class="db-hero">
        <p class="db-hero__label">Continental</p>
        <h1 class="db-hero__title">KNOCKOUT CUP</h1>
      </header>
      <div class="panel">
        <p>${squads.length} squads entered · single elimination</p>
        ${resultHtml}
        <button class="btn" id="share" style="margin-top:12px;width:100%">Copy squad share code</button>
      </div>
    </div>`;

  root.querySelector("#back")?.addEventListener("click", () => navigate("draftballer"));
  root.querySelector("#share")?.addEventListener("click", async () => {
    const squad = loadSquadForSeason();
    if (!squad) return;
    const code = encodeSquadShare({
      name: "My XI",
      mode: squad.mode,
      playerIds: squad.playerIds,
      squadOvr: squad.squadOvr,
      source: squad.source,
      cards: squad.players.map((p) => ({
        playerId: p.playerId,
        name: p.name,
        ovr: p.ovr,
        position: p.position,
      })),
    });
    await navigator.clipboard.writeText(code);
    alert("Squad code copied — send to a rival for H2H or UCL.");
  });
}

export function renderDraftballerImport(root: HTMLElement, code: string, navigate: Navigate) {
  try {
    const payload = decodeSquadShare(decodeURIComponent(code));
    sessionStorage.setItem(
      "db_squad",
      JSON.stringify({
        mode: payload.mode,
        playerIds: payload.playerIds,
        squadOvr: payload.squadOvr,
        source: payload.source,
      }),
    );
    root.innerHTML = `<div class="shell db-root"><p>Imported squad: ${payload.name} (OVR ${payload.squadOvr})</p></div>`;
    setTimeout(() => navigate("draftballer", "h2h"), 800);
  } catch {
    root.innerHTML = `<div class="shell db-root"><p>Invalid squad code.</p><button class="btn" id="hub">Hub</button></div>`;
    root.querySelector("#hub")?.addEventListener("click", () => navigate("draftballer"));
  }
}
