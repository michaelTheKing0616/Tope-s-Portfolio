import {
  featuredModeForDate,
  latestTrophyTitle,
  loadHubProgress,
  loadTrophies,
} from "@sportverse/draftballer-core";
import { poolCounts } from "@sportverse/sports-db";
import type { RatedPlayerCard } from "@sportverse/draftballer-types";
import { playerCardFaceHtml, type PlayerCardFaceOptions } from "../lib/player-card.js";

type Navigate = (route: string, param?: string) => void;

interface SimValidationReport {
  count: number;
  rps: number;
  brier: number;
  logLoss: number;
  accuracy: number;
  generatedAt?: string;
  note?: string;
}

let cachedValidation: SimValidationReport | null | undefined;

async function loadValidationReport(): Promise<SimValidationReport | null> {
  if (cachedValidation !== undefined) return cachedValidation;
  try {
    const base = import.meta.env.BASE_URL ?? "/";
    const res = await fetch(`${base}data/sim-validation-report.json`);
    if (!res.ok) {
      cachedValidation = null;
      return null;
    }
    cachedValidation = (await res.json()) as SimValidationReport;
    return cachedValidation;
  } catch {
    cachedValidation = null;
    return null;
  }
}

/** Draft face card — hybrid data-centric layout (radar + archetype). */
export function playerCardHtml(
  card: RatedPlayerCard,
  compact = false,
  opts: PlayerCardFaceOptions = {},
): string {
  return playerCardFaceHtml(card, compact, opts);
}

export function renderDraftballerHub(root: HTMLElement, navigate: Navigate) {
  const counts = poolCounts();
  const trophies = loadTrophies();
  const progress = loadHubProgress();
  const featured = featuredModeForDate();
  const latestTrophy = latestTrophyTitle();

  const paint = (validation: SimValidationReport | null) => {
  root.innerHTML = `
    <div class="shell db-root">
      <button class="btn btn--ghost" id="back">← SPORTVERSE Hub</button>
      <header class="db-hero">
        <p class="db-hero__label">DRAFTBALLER</p>
        <h1 class="db-hero__title">DRAFT THE<br/>GREATEST XI</h1>
        <p style="color:var(--db-muted);max-width:48ch;margin:0 auto">
          ${counts.draftPlayers.toLocaleString()} players · ${counts.seasonStatRows?.toLocaleString() ?? "—"} stat rows · Transfermarkt + World Cup + curated
        </p>
      </header>
      <section class="panel db-progress-module" aria-label="Your progress">
        <p class="db-hero__label">Your progress</p>
        <div class="db-progress-grid">
          <div><span class="db-stat-label">Best record</span><strong>${progress.bestPoints ? `${progress.bestPoints} pts · ${progress.bestRecord}` : "—"}</strong></div>
          <div><span class="db-stat-label">Daily streak</span><strong>${progress.dailyStreak || 0}</strong></div>
          <div><span class="db-stat-label">Latest trophy</span><strong>${latestTrophy ?? "—"}</strong></div>
          <div>
            <span class="db-stat-label">Featured this week</span>
            <a class="db-featured-link" href="#/draftballer/mode/${featured.id}"><strong>${featured.title}</strong></a>
          </div>
        </div>
      </section>
      <div class="db-grid">
        <a class="db-card db-card--featured" href="#/draftballer/wheel">
          <strong style="color:var(--db-gold)">Spin & Build</strong>
          <p style="font-size:0.85rem;color:var(--db-muted)">Wheel randomizer — land on a club, draft your XI (38-0 style)</p>
        </a>
        <a class="db-card db-card--featured" href="#/draftballer/daily">
          <strong style="color:var(--db-emerald-hi)">Daily Challenge</strong>
          <p style="font-size:0.85rem;color:var(--db-muted)">Wordle-style shared draft pool each day</p>
        </a>
        <a class="db-card db-card--architect" href="#/draftballer/architect">
          <strong style="color:var(--db-gold)">Build your own</strong>
          <p style="font-size:0.85rem;color:var(--db-muted)">Draft Architect — pro-mode filters, lens blend & shareable presets</p>
        </a>
        <a class="db-card" href="#/draftballer/mode/all-time-any">
          <strong>All-Time · Spin</strong>
          <p style="font-size:0.85rem;color:var(--db-muted)">Quick wheel draft, any league</p>
        </a>
        <a class="db-card" href="#/draftballer/mode/premier-league">
          <strong>Premier League · Spin</strong>
          <p style="font-size:0.85rem;color:var(--db-muted)">PL clubs on the wheel</p>
        </a>
        <a class="db-card" href="#/draftballer/mode/international">
          <strong>International · Spin</strong>
          <p style="font-size:0.85rem;color:var(--db-muted)">Nations on the wheel</p>
        </a>
        <a class="db-card" href="#/draftballer/room">
          <strong>Snake Draft vs Bot</strong>
          <p style="font-size:0.85rem;color:var(--db-muted)">Classic 1v1 snake order (default 45s/pick in MP)</p>
        </a>
        <a class="db-card" href="#/draftballer/room/linear">
          <strong>Linear Draft vs Bot</strong>
          <p style="font-size:0.85rem;color:var(--db-muted)">Same pick order every round</p>
        </a>
        <a class="db-card" href="#/draftballer/auction">
          <strong>Auction vs Bot</strong>
          <p style="font-size:0.85rem;color:var(--db-muted)">Budget bidding on nominated players</p>
        </a>
        <a class="db-card" href="#/draftballer/blind">
          <strong>Blind Draft vs Bot</strong>
          <p style="font-size:0.85rem;color:var(--db-muted)">Simultaneous hidden picks each round</p>
        </a>
        <a class="db-card" href="#/draftballer/mp-lobby">
          <strong>Multiplayer Lobby</strong>
          <p style="font-size:0.85rem;color:var(--db-muted)">Create or join a live draft room</p>
        </a>
        <a class="db-card db-card--featured" href="#/draftballer/squad-builder">
          <strong style="color:var(--db-gold)">Squad Builder</strong>
          <p style="font-size:0.85rem;color:var(--db-muted)">Formation shape + tactical identity before you simulate</p>
        </a>
        <a class="db-card db-card--featured" href="#/draftballer/sim-setup">
          <strong style="color:var(--db-emerald-hi)">Simulation Conditions</strong>
          <p style="font-size:0.85rem;color:var(--db-muted)">Era context, weather, Prime Powers toggle</p>
        </a>
        <a class="db-card" href="#/draftballer/era-lab">
          <strong>Era Lab</strong>
          <p style="font-size:0.85rem;color:var(--db-muted)">Batch-test your XI across every reference era</p>
        </a>
        <a class="db-card" href="#/draftballer/compare">
          <strong>Compare</strong>
          <p style="font-size:0.85rem;color:var(--db-muted)">Club vs international — same player, two contexts</p>
        </a>
        <a class="db-card" href="#/draftballer/ucl">
          <strong>Knockout Cup</strong>
          <p style="font-size:0.85rem;color:var(--db-muted)">UCL-style bracket after your XI</p>
        </a>
        <a class="db-card" href="#/draftballer/mini-league">
          <strong>Mini League</strong>
          <p style="font-size:0.85rem;color:var(--db-muted)">Round-robin table with AI squads</p>
        </a>
      </div>
      ${
        trophies.length
          ? `<div class="panel db-trophy-panel">
              <p class="db-hero__label">Trophy case</p>
              <ul class="db-trophy-list">
                ${trophies
                  .slice(0, 8)
                  .map((t) => `<li><strong>${t.title}</strong><span>${t.detail}</span></li>`)
                  .join("")}
              </ul>
            </div>`
          : ""
      }
      <footer class="db-hub-footer panel">
        <p class="db-trust-badge">
          ${
            validation
              ? `Sim engine validated vs <strong>${validation.count}</strong> historical fixtures — <a href="#methodology" id="methodology-link">see methodology</a>`
              : `Sim engine validation report loading… — <a href="#methodology" id="methodology-link">see methodology</a>`
          }
        </p>
        <details class="db-methodology" id="methodology">
          <summary>Methodology</summary>
          <p style="font-size:0.85rem;color:var(--db-muted);margin-top:8px">
            Dixon–Coles Layer-1 forecasts are scored with Ranked Probability Score, Brier, and log-loss
            against a holdout of cross-league fixtures (Engine v4 §4). The 2017 Soccer Prediction Challenge
            benchmark (RPS 0.2063) is a directional reference, not an identical task.
            ${
              validation
                ? `<br/>Latest holdout: n=${validation.count}, RPS=${validation.rps.toFixed(4)}, Brier=${validation.brier.toFixed(4)}, accuracy=${(validation.accuracy * 100).toFixed(1)}%.`
                : ""
            }
            ${validation?.note ? `<br/><em>${validation.note}</em>` : ""}
            <br/>Fame never influences OVR — only pool visibility. Market-value blend is a separate, capped, labeled input.
          </p>
        </details>
      </footer>
    </div>`;
  root.querySelector("#back")?.addEventListener("click", () => navigate("hub"));
  root.querySelector("#methodology-link")?.addEventListener("click", (e) => {
    e.preventDefault();
    const el = root.querySelector("#methodology") as HTMLDetailsElement | null;
    if (el) el.open = true;
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
  };

  paint(cachedValidation ?? null);
  void loadValidationReport().then((v) => paint(v));
}
