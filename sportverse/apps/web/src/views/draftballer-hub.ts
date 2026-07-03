import { loadTrophies } from "@sportverse/draftballer-core";
import { poolCounts } from "@sportverse/sports-db";
import type { RatedPlayerCard } from "@sportverse/draftballer-types";

type Navigate = (route: string, param?: string) => void;

export function playerCardHtml(card: RatedPlayerCard, compact = false): string {
  const attrs = card.attributes;
  return `
    <div class="db-player-card db-player-card--clickable" data-tier="${card.tier}" data-id="${card.playerId}" title="Tap for rating breakdown">
      <span class="db-ovr">${card.ovr}</span>
      <span class="db-pos">${card.position}</span>
      <div class="db-name">${card.name}</div>
      ${
        compact
          ? ""
          : `<div class="db-stats">
        <span>PAC ${attrs.pac}</span><span>SHO ${attrs.sho}</span><span>PAS ${attrs.pas}</span>
        <span>DRI ${attrs.dri}</span><span>DEF ${attrs.def}</span><span>PHY ${attrs.phy}</span>
      </div>`
      }
    </div>`;
}

export function renderDraftballerHub(root: HTMLElement, navigate: Navigate) {
  const counts = poolCounts();
  const trophies = loadTrophies();

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
      <div class="db-grid">
        <a class="db-card db-card--featured" href="#/draftballer/wheel">
          <strong style="color:var(--db-gold)">Spin & Build</strong>
          <p style="font-size:0.85rem;color:var(--db-muted)">Wheel randomizer — land on a club, draft your XI (38-0 style)</p>
        </a>
        <a class="db-card db-card--featured" href="#/draftballer/daily">
          <strong style="color:var(--db-emerald-hi)">Daily Challenge</strong>
          <p style="font-size:0.85rem;color:var(--db-muted)">Wordle-style shared draft pool each day</p>
        </a>
        <a class="db-card db-card--featured" href="#/draftballer/architect">
          <strong style="color:var(--db-emerald-hi)">Draft Architect</strong>
          <p style="font-size:0.85rem;color:var(--db-muted)">Custom era, scope & rating lens</p>
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
    </div>`;
  root.querySelector("#back")?.addEventListener("click", () => navigate("hub"));
}
