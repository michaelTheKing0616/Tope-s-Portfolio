import type { RatedPlayerCard } from "@sportverse/draftballer-types";

type Navigate = (route: string, param?: string) => void;

export function playerCardHtml(card: RatedPlayerCard, compact = false): string {
  const attrs = card.attributes;
  return `
    <div class="db-player-card" data-tier="${card.tier}" data-id="${card.playerId}">
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
  root.innerHTML = `
    <div class="shell db-root">
      <button class="btn btn--ghost" id="back">← SPORTVERSE Hub</button>
      <header class="db-hero">
        <p class="db-hero__label">DRAFTBALLER</p>
        <h1 class="db-hero__title">DRAFT THE<br/>GREATEST XI</h1>
        <p style="color:var(--db-muted);max-width:48ch;margin:0 auto">Fantasy draft meets Ultimate Team — any era, any league, ratings you can trust.</p>
      </header>
      <div class="db-grid">
        <a class="db-card db-card--featured" href="#/draftballer/architect">
          <strong style="color:var(--db-gold)">Draft Architect</strong>
          <p style="font-size:0.85rem;color:var(--db-muted)">Custom era, scope & rating lens</p>
        </a>
        <a class="db-card" href="#/draftballer/mode/all-time-any">
          <strong>All-Time</strong>
          <p style="font-size:0.85rem;color:var(--db-muted)">Peak careers, any league</p>
        </a>
        <a class="db-card" href="#/draftballer/mode/international">
          <strong>International</strong>
          <p style="font-size:0.85rem;color:var(--db-muted)">National team legends</p>
        </a>
        <a class="db-card" href="#/draftballer/mode/premier-league">
          <strong>Premier League</strong>
          <p style="font-size:0.85rem;color:var(--db-muted)">All-time PL icons</p>
        </a>
      </div>
    </div>`;
  root.querySelector("#back")?.addEventListener("click", () => navigate("hub"));
}
