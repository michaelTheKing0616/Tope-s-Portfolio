import type { SimSquadInput } from "@sportverse/draftballer-types";
import {
  buildDraftPool,
  loadSimConfig,
  loadSquadForSeason,
  PRESET_MODES,
} from "@sportverse/draftballer-core";
import { simulateRoundRobin, type RoundRobinTeam } from "@sportverse/match-sim";
import { getSeasonStats } from "@sportverse/sports-db";

type Navigate = (route: string, param?: string) => void;

const AI_TEAM_COUNT = 4;
const SQUAD_SIZE = 11;

function standingsTableHtml(
  standings: {
    name: string;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
    points: number;
  }[],
  championName: string,
): string {
  const rows = standings
    .map((s, i) => {
      const isChamp = s.name === championName;
      return `<tr style="${isChamp ? "color:var(--db-gold)" : ""}">
        <td>${i + 1}</td>
        <td><strong>${s.name}</strong></td>
        <td>${s.played}</td>
        <td>${s.won}</td>
        <td>${s.drawn}</td>
        <td>${s.lost}</td>
        <td>${s.goalsFor}</td>
        <td>${s.goalsAgainst}</td>
        <td>${s.goalDifference >= 0 ? "+" : ""}${s.goalDifference}</td>
        <td><strong>${s.points}</strong></td>
      </tr>`;
    })
    .join("");

  return `
    <div class="panel" style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:0.85rem;text-align:center">
        <thead>
          <tr style="color:var(--db-muted);border-bottom:1px solid var(--db-border)">
            <th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

export function renderDraftballerMiniLeague(root: HTMLElement, navigate: Navigate) {
  const saved = loadSquadForSeason();
  const mode = saved?.mode ?? PRESET_MODES[0]!;
  const pool = buildDraftPool(mode);
  const teams: RoundRobinTeam[] = [];

  if (saved?.players.length === SQUAD_SIZE) {
    const userSquad: SimSquadInput = {
      name: "Your XI",
      playerIds: saved.playerIds,
      players: saved.players,
      squadOvr: saved.squadOvr,
    };
    teams.push({ id: "you", name: "Your XI", squad: userSquad });
  }

  for (let i = 0; i < AI_TEAM_COUNT; i++) {
    const slice = pool.slice(i * SQUAD_SIZE, i * SQUAD_SIZE + SQUAD_SIZE);
    if (slice.length < SQUAD_SIZE) break;
    const squadOvr = Math.round(slice.reduce((s, p) => s + p.ovr, 0) / slice.length);
    teams.push({
      id: `ai${i}`,
      name: `AI ${i + 1}`,
      squad: {
        name: `AI ${i + 1}`,
        playerIds: slice.map((p) => p.playerId),
        players: slice,
        squadOvr,
      },
    });
  }

  if (teams.length < 3) {
    root.innerHTML = `
      <div class="shell db-root">
        <button class="btn btn--ghost" id="back">← Hub</button>
        <header class="db-hero">
          <p class="db-hero__label">Mini League</p>
          <h1 class="db-hero__title">NOT ENOUGH TEAMS</h1>
          <p class="db-hero__sub">Need at least 3 squads — complete an 11-player draft first.</p>
        </header>
        <button class="btn" id="draft">Start a draft</button>
      </div>`;
    root.querySelector("#back")?.addEventListener("click", () => navigate("draftballer"));
    root.querySelector("#draft")?.addEventListener("click", () => navigate("draftballer", "room"));
    return;
  }

  const simConfig = loadSimConfig();
  const result = simulateRoundRobin(teams, `mini-${Date.now()}`, {
    simConfig,
    statsFor: (id) => getSeasonStats(id),
  });

  const recentFixtures = result.fixtures.slice(-6).reverse();

  root.innerHTML = `
    <div class="shell db-root">
      <button class="btn btn--ghost" id="back">← Hub</button>
      <header class="db-hero">
        <p class="db-hero__label">${mode.title ?? mode.id} · Round Robin</p>
        <h1 class="db-hero__title">MINI LEAGUE</h1>
        <p class="db-hero__sub">${teams.length} teams · ${result.fixtures.length} fixtures</p>
        <p style="color:var(--db-gold);margin-top:8px">Champion: <strong>${result.championName}</strong></p>
      </header>
      ${standingsTableHtml(result.standings, result.championName)}
      <div class="panel" style="margin-top:12px">
        <strong>Recent results</strong>
        <ul style="color:var(--db-muted);font-size:0.85rem;margin-top:8px;padding-left:1.2rem">
          ${recentFixtures.map((f) => `<li>MD${f.matchday}: ${f.homeName} ${f.homeGoals}–${f.awayGoals} ${f.awayName}</li>`).join("")}
        </ul>
      </div>
      <button class="btn" id="season" style="width:100%;margin-top:12px">Back to season</button>
    </div>`;

  root.querySelector("#back")?.addEventListener("click", () => navigate("draftballer"));
  root.querySelector("#season")?.addEventListener("click", () => navigate("draftballer", "season"));
}
