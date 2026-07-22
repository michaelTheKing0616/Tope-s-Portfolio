import type { SimSquadInput } from "@sportverse/draftballer-types";
import {
  buildDraftPool,
  PRESET_MODES,
  loadSquadForSeason,
  encodeSquadShare,
  decodeSquadShare,
  loadSimConfig,
  loadSquadBuilderState,
} from "@sportverse/draftballer-core";
import {
  simulateKnockoutBracket,
  type KnockoutResult,
  type KnockoutSquad,
} from "@sportverse/match-sim";
import { bindEliteMotion } from "../lib/elite-motion.js";

type KnockoutMatchRow = KnockoutResult["rounds"][number][number];

type Navigate = (route: string, param?: string) => void;

const ROUND_PHASE: Record<string, string> = {
  "Round of 16": "PHASE 01: R16",
  "Quarter-Final": "PHASE 02: QF",
  "Semi-Final": "PHASE 03: SF",
  Final: "THE FINAL",
};

interface BracketTie {
  home: KnockoutSquad;
  away: KnockoutSquad;
  homeGoals: number | null;
  awayGoals: number | null;
  aggregateHome?: number;
  aggregateAway?: number;
  pending: boolean;
  winnerId?: string;
}

function groupRoundTies(matches: KnockoutMatchRow[]): BracketTie[] {
  const ties: BracketTie[] = [];
  const used = new Set<number>();

  for (let i = 0; i < matches.length; i++) {
    if (used.has(i)) continue;
    const m = matches[i]!;
    const leg2Idx = matches.findIndex(
      (x, j) =>
        j > i &&
        !used.has(j) &&
        x.leg === 2 &&
        x.home.id === m.away.id &&
        x.away.id === m.home.id,
    );

    if (leg2Idx >= 0) {
      const leg2 = matches[leg2Idx]!;
      used.add(i);
      used.add(leg2Idx);
      const aggH = leg2.aggregateHome ?? m.homeGoals + leg2.awayGoals;
      const aggA = leg2.aggregateAway ?? m.awayGoals + leg2.homeGoals;
      ties.push({
        home: m.home,
        away: m.away,
        homeGoals: aggH,
        awayGoals: aggA,
        aggregateHome: aggH,
        aggregateAway: aggA,
        pending: false,
        winnerId: aggH > aggA ? m.home.id : aggA > aggH ? m.away.id : undefined,
      });
    } else {
      used.add(i);
      ties.push({
        home: m.home,
        away: m.away,
        homeGoals: m.homeGoals,
        awayGoals: m.awayGoals,
        pending: m.home.name === "BYE" || m.away.name === "BYE",
        winnerId: m.homeGoals >= m.awayGoals ? m.home.id : m.away.id,
      });
    }
  }

  return ties;
}

function shortName(name: string): string {
  if (name.length <= 12) return name;
  return name.slice(0, 10) + "…";
}

function matchCardHtml(tie: BracketTie): string {
  if (tie.pending) {
    return `
      <div class="db-knockout-match db-glass db-knockout-match--pending">
        <div class="db-knockout-match__team">
          <span>${shortName(tie.home.name)}</span>
          <span class="db-knockout-match__score">—</span>
        </div>
        <div class="db-knockout-match__team db-knockout-match__team--lose">
          <span>${shortName(tie.away.name)}</span>
          <span class="db-knockout-match__score">—</span>
        </div>
        <p class="db-knockout-match__ft db-label-caps">Pending</p>
      </div>`;
  }

  const homeWin = tie.winnerId === tie.home.id;
  const awayWin = tie.winnerId === tie.away.id;
  const ft =
    tie.aggregateHome != null
      ? `AGG ${tie.aggregateHome}:${tie.aggregateAway}`
      : `FT ${tie.homeGoals}:${tie.awayGoals}`;

  return `
    <div class="db-knockout-match db-glass">
      <div class="db-knockout-match__team${homeWin ? " db-knockout-match__team--win" : ""}">
        <span>${shortName(tie.home.name)}</span>
        <span class="db-knockout-match__score">${tie.homeGoals ?? "—"}</span>
      </div>
      <div class="db-knockout-match__team${awayWin ? " db-knockout-match__team--win" : ""}${!awayWin && !homeWin ? " db-knockout-match__team--lose" : ""}">
        <span>${shortName(tie.away.name)}</span>
        <span class="db-knockout-match__score">${tie.awayGoals ?? "—"}</span>
      </div>
      <p class="db-knockout-match__ft db-label-caps">${ft}</p>
    </div>`;
}

function bracketColumnHtml(roundLabel: string, ties: BracketTie[]): string {
  const phase = ROUND_PHASE[roundLabel] ?? roundLabel.toUpperCase();
  return `
    <div class="db-knockout-col">
      <h3 class="db-label-caps db-knockout-col__phase">${phase}</h3>
      ${ties.map((t) => matchCardHtml(t)).join("")}
    </div>`;
}

function bracketHtml(result: KnockoutResult): string {
  return result.rounds
    .map((roundMatches, idx) => {
      const roundLabel = result.bracket[idx]?.round ?? `Round ${idx + 1}`;
      return bracketColumnHtml(roundLabel, groupRoundTies(roundMatches));
    })
    .join("");
}

function statsOverviewHtml(squads: KnockoutSquad[]): string {
  const rows = squads
    .filter((s) => s.name !== "BYE")
    .slice(0, 6)
    .map((s) => {
      const ovr = s.squad.squadOvr ?? 0;
      const pct = Math.min(100, Math.round((ovr / 95) * 100));
      return `
        <div class="db-knockout-stat-row">
          <div class="db-knockout-stat-row__head">
            <span>${s.name}</span>
            <span>${ovr} OVR</span>
          </div>
          <div class="db-knockout-stat-row__bar"><div style="width:${pct}%"></div></div>
        </div>`;
    })
    .join("");

  return rows || `<p class="db-knockout-empty">No squads loaded.</p>`;
}

function upcomingHtml(result: KnockoutResult | null): string {
  if (!result) {
    return `<p class="db-knockout-upcoming__vs">—</p><p class="db-knockout-upcoming__meta">Simulate bracket to preview</p>`;
  }
  const champ = result.champion.name;
  const lastRound = result.bracket[result.bracket.length - 1];
  const finalists = lastRound?.winners.join(" vs ") ?? champ;
  return `
    <p class="db-knockout-upcoming__vs">${finalists}</p>
    <p class="db-knockout-upcoming__meta">Champion: <strong>${champ}</strong></p>`;
}

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

  let result: KnockoutResult | null = null;
  if (squads.length >= 2) {
    const simConfig = loadSimConfig();
    const builder = loadSquadBuilderState();
    const knockoutConfig = {
      ...simConfig,
      formationHomeId: mySquad?.formationId ?? builder.formationId ?? simConfig.formationHomeId,
      isKnockout: true,
    };
    result = simulateKnockoutBracket(squads.slice(0, 8), `ucl-${Date.now()}`, {
      simConfig: knockoutConfig,
      twoLegged: true,
      twoLeggedFromRound: "Semi-Final",
    });
  }

  root.innerHTML = `
    <div class="shell db-root db-knockout-page">
      <button class="btn btn--ghost" id="back">← Hub</button>

      <header class="db-knockout-header">
        <div class="db-knockout-header__badges">
          <span class="db-knockout-live db-label-caps db-soft-pulse"><span class="db-knockout-live__dot"></span> Live Feed</span>
          <span class="db-label-caps db-knockout-header__node">Node: Elite Knockout Cup</span>
        </div>
        <h1 class="db-knockout-header__title">Road to the Final</h1>
        <p class="db-knockout-header__sub">${squads.filter((s) => s.name !== "BYE").length} squads · single elimination</p>
      </header>

      ${
        result
          ? `<div class="db-knockout-bracket-wrap">
              <div class="db-knockout-bracket">${bracketHtml(result)}</div>
            </div>`
          : `<div class="db-glass db-knockout-empty-state">Need at least 2 squads to simulate bracket.</div>`
      }

      <div class="db-knockout-bento">
        <div class="db-knockout-bento__card db-glass">
          <div class="db-knockout-bento__head">
            <h4 class="db-label-caps">Statistical Overview</h4>
          </div>
          ${statsOverviewHtml(squads)}
        </div>

        <div class="db-knockout-bento__card db-glass">
          <h4 class="db-label-caps">Distribution Data</h4>
          <p class="db-knockout-share__hint">Share your squad code for H2H or knockout imports.</p>
          <button class="db-btn-pitch db-knockout-share__btn" id="share">Copy Squad Share Code</button>
        </div>

        <div class="db-knockout-bento__card db-glass db-knockout-bento__card--upcoming">
          <h4 class="db-label-caps">Upcoming</h4>
          ${upcomingHtml(result)}
        </div>
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
    const btn = root.querySelector("#share");
    if (btn) {
      const prev = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(() => {
        btn.textContent = prev;
      }, 2000);
    }
  });

  const pageRoot = root.querySelector(".db-root") as HTMLElement | null;
  if (pageRoot) bindEliteMotion(pageRoot, { scan: "line" });
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
