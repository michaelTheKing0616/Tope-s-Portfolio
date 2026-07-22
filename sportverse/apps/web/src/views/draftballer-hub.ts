import {
  featuredModeForDate,
  latestTrophyTitle,
  loadHubProgress,
  loadTrophies,
} from "@sportverse/draftballer-core";
import { poolCounts } from "@sportverse/sports-db";
import type { RatedPlayerCard } from "@sportverse/draftballer-types";
import { bindEliteMotion } from "../lib/elite-motion.js";
import { keepieLoaderHtml } from "../lib/keepie-loader.js";
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

function hubXp(progress: ReturnType<typeof loadHubProgress>, trophyCount: number): number {
  return progress.bestPoints + progress.dailyStreak * 25 + trophyCount * 50;
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
  const xp = hubXp(progress, trophies.length);

  const bestRecordLabel = progress.bestPoints
    ? `${progress.bestPoints} pts · ${progress.bestRecord}`
    : "No season logged";

  const paint = (validation: SimValidationReport | null) => {
    root.innerHTML = `
    <div class="shell db-root db-hub-page">
      <button class="btn btn--ghost" id="back">← SPORTVERSE Hub</button>

      <header class="db-hub-topbar">
        <div class="db-hub-topbar__brand">
          <div class="db-hub-topbar__icon" aria-hidden="true">DB</div>
          <h1 class="db-hub-topbar__title">DraftBaller Hub</h1>
        </div>
        <div class="db-hub-xp-chip db-soft-pulse">
          <span class="db-hub-xp-dot" aria-hidden="true"></span>
          <span>${xp.toLocaleString()} XP</span>
        </div>
      </header>

      <section class="db-hub-command">
        <p class="db-label-caps">Command Center</p>
        <h2 class="db-hub-command__title">Back on the pitch, elite.</h2>
      </section>

      <section class="db-hub-status-grid" aria-label="Your progress">
        <div class="db-glass db-hub-status-card">
          <span class="db-hub-status-card__icon" aria-hidden="true">🏆</span>
          <div>
            <p class="db-label-caps">Latest Trophy</p>
            <p class="db-hub-status-card__value">${latestTrophy ?? "—"}</p>
          </div>
        </div>
        <div class="db-glass db-hub-status-card">
          <span class="db-hub-status-card__icon" aria-hidden="true">⚡</span>
          <div>
            <p class="db-label-caps">Daily Streak</p>
            <p class="db-hub-status-card__value">${progress.dailyStreak ? `${progress.dailyStreak} days active` : "Start today"}</p>
          </div>
        </div>
        <div class="db-glass db-hub-status-card">
          <span class="db-hub-status-card__icon" aria-hidden="true">📈</span>
          <div>
            <p class="db-label-caps">Best Record</p>
            <p class="db-hub-status-card__value">${bestRecordLabel}</p>
          </div>
        </div>
        <div class="db-glass db-hub-status-card">
          <span class="db-hub-status-card__icon" aria-hidden="true">◎</span>
          <div>
            <p class="db-label-caps">Featured Mode</p>
            <p class="db-hub-status-card__value">
              <a class="db-featured-link" href="#/draftballer/mode/${featured.id}">${featured.title}</a>
            </p>
          </div>
        </div>
      </section>

      <section class="db-hub-arena">
        <div class="db-hub-arena__head">
          <p class="db-label-caps">Arena Modules</p>
        </div>
        <a class="db-glass db-hub-featured" href="#/draftballer/wheel">
          <span class="db-hub-featured__badge">Featured Mode</span>
          <h3 class="db-hub-featured__title">Spin &amp; Build</h3>
          <p style="font-size:0.875rem;color:var(--db-muted);margin:0;max-width:32ch;line-height:1.5">
            Wheel randomizer — land on a club, draft your XI.
          </p>
          <span class="db-btn-pitch db-hub-featured__cta">Initialize Arena →</span>
        </a>
        <div class="db-hub-tiles">
          <a class="db-glass db-hub-tile" href="#/draftballer/daily">
            <p class="db-hub-tile__title">Daily Protocol</p>
            <p style="font-size:0.72rem;color:var(--db-muted);margin:0;line-height:1.4">Shared draft pool each day.</p>
          </a>
          <a class="db-glass db-hub-tile" href="#/draftballer/architect">
            <p class="db-hub-tile__title">Custom Engine</p>
            <p style="font-size:0.72rem;color:var(--db-muted);margin:0;line-height:1.4">Filters, lens blend &amp; presets.</p>
          </a>
        </div>
      </section>

      <section class="db-glass db-hub-data-panel" aria-label="Pool and engine status">
        <p class="db-label-caps">Season Ready</p>
        <p style="font-size:0.875rem;color:var(--db-muted);margin:6px 0 0;line-height:1.5">
          ${
            validation
              ? `Sim engine validated vs ${validation.count.toLocaleString()} fixtures — RPS ${validation.rps.toFixed(4)}. Pick a challenger league and run 38 games.`
              : "Pool loaded — select a historical challenger season and simulate when your XI is set."
          }
        </p>
        <div class="db-hub-data-panel__grid">
          <div class="db-hub-data-stat">
            <span class="db-label-caps">Draft Pool</span>
            <strong>${counts.draftPlayers.toLocaleString()}</strong>
          </div>
          <div class="db-hub-data-stat">
            <span class="db-label-caps">Stat Rows</span>
            <strong>${counts.seasonStatRows?.toLocaleString() ?? "—"}</strong>
          </div>
          ${
            validation
              ? `<div class="db-hub-data-stat">
                  <span class="db-label-caps">Holdout RPS</span>
                  <strong>${validation.rps.toFixed(4)}</strong>
                </div>
                <div class="db-hub-data-stat">
                  <span class="db-label-caps">Accuracy</span>
                  <strong>${(validation.accuracy * 100).toFixed(1)}%</strong>
                </div>`
              : `<div class="db-hub-data-stat">
                  <span class="db-label-caps">Sources</span>
                  <strong>TM + WC</strong>
                </div>
                <div class="db-hub-data-stat">
                  <span class="db-label-caps">Curated</span>
                  <strong>Legends</strong>
                </div>`
          }
        </div>
      </section>

      <details class="db-hub-more">
        <summary class="db-label-caps">All modes &amp; tools</summary>
        <div class="db-grid" style="margin-top:12px">
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
            <p style="font-size:0.85rem;color:var(--db-muted)">Classic 1v1 snake order</p>
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
            <strong style="color:var(--db-pitch)">Squad Builder</strong>
            <p style="font-size:0.85rem;color:var(--db-muted)">Formation shape + tactical identity</p>
          </a>
          <a class="db-card db-card--featured" href="#/draftballer/sim-setup">
            <strong style="color:var(--db-pitch)">Simulation Conditions</strong>
            <p style="font-size:0.85rem;color:var(--db-muted)">Era context, weather, Prime Powers</p>
          </a>
          <a class="db-card" href="#/draftballer/era-lab">
            <strong>Era Lab</strong>
            <p style="font-size:0.85rem;color:var(--db-muted)">Batch-test your XI across every era</p>
          </a>
          <a class="db-card" href="#/draftballer/compare">
            <strong>Compare</strong>
            <p style="font-size:0.85rem;color:var(--db-muted)">Club vs international contexts</p>
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
      </details>

      ${
        trophies.length
          ? `<div class="panel db-trophy-panel db-glass" style="margin-top:1.5rem;padding:1rem;border-radius:16px">
              <p class="db-label-caps">Trophy Case</p>
              <ul class="db-trophy-list">
                ${trophies
                  .slice(0, 8)
                  .map((t) => `<li><strong>${t.title}</strong><span>${t.detail}</span></li>`)
                  .join("")}
              </ul>
            </div>`
          : ""
      }

      <footer class="db-hub-footer panel db-glass" style="margin-top:1.5rem;padding:1rem;border-radius:16px">
        <p class="db-trust-badge">
          ${
            validation
              ? `Sim engine validated vs <strong>${validation.count}</strong> historical fixtures — <a href="#methodology" id="methodology-link">see methodology</a>`
              : `<span class="db-trust-badge__loading">${keepieLoaderHtml({ size: 48, label: "Validating", className: "db-keepie--inline" })}</span>
                 <span>Sim engine validation report loading… — <a href="#methodology" id="methodology-link">see methodology</a></span>`
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
    const pageRoot = root.querySelector(".db-root") as HTMLElement | null;
    if (pageRoot) bindEliteMotion(pageRoot, { scan: "line" });
  };

  paint(cachedValidation ?? null);
  void loadValidationReport().then((v) => paint(v));
}
