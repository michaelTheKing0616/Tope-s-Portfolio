import type { RatedPlayerCard } from "@sportverse/draftballer-types";
import {
  derivePlayerCardProfile,
  signatureGlyph,
  starsHtml,
  type PlayerCardProfile,
} from "@sportverse/draftballer-core";

const ATTR_KEYS = ["pac", "sho", "pas", "dri", "def", "phy"] as const;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Compact radar — soft Apple-style stroke, labels optional. */
export function attributeRadarSvg(
  attrs: RatedPlayerCard["attributes"],
  size = 88,
  opts?: { labels?: boolean },
): string {
  const keys = ATTR_KEYS;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * (opts?.labels ? 0.34 : 0.4);
  const rings = [0.4, 0.7, 1].map(
    (f) =>
      `<polygon points="${keys
        .map((_, i) => {
          const a = (Math.PI * 2 * i) / keys.length - Math.PI / 2;
          return `${cx + Math.cos(a) * r * f},${cy + Math.sin(a) * r * f}`;
        })
        .join(" ")}" fill="none" stroke="rgba(29,29,31,0.08)" stroke-width="0.8"/>`,
  );
  const pts = keys
    .map((k, i) => {
      const a = (Math.PI * 2 * i) / keys.length - Math.PI / 2;
      const v = Math.max(0.12, attrs[k] / 99);
      return `${cx + Math.cos(a) * r * v},${cy + Math.sin(a) * r * v}`;
    })
    .join(" ");
  const labels = opts?.labels
    ? keys
        .map((k, i) => {
          const a = (Math.PI * 2 * i) / keys.length - Math.PI / 2;
          const lx = cx + Math.cos(a) * (r + size * 0.12);
          const ly = cy + Math.sin(a) * (r + size * 0.12);
          return `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" fill="#86868b" font-size="${Math.max(8, size * 0.08)}" font-family="var(--font-ui)">${k.toUpperCase()}</text>`;
        })
        .join("")
    : "";
  return `<svg class="db-card-radar" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">${rings.join("")}<polygon points="${pts}" fill="rgba(0,113,227,0.14)" stroke="#0071e3" stroke-width="1.5"/>${labels}</svg>`;
}

function influenceBar(label: string, value: number): string {
  const pct = Math.max(4, Math.min(100, value));
  return `<div class="db-influence-row"><span>${label}</span><div class="db-influence-track"><div class="db-influence-fill" style="width:${pct}%"></div></div><strong>${value}</strong></div>`;
}

/**
 * Face card — Apple / 38-0 inspired: airy white tile, big OVR, quiet radar.
 */
export interface PlayerCardFaceOptions {
  /** Cannot play the active slot — show greyed out, not clickable. */
  ineligible?: boolean;
  /** Meets squad-quality nudge for this pick. */
  recommended?: boolean;
}

export function playerCardFaceHtml(
  card: RatedPlayerCard,
  compact = false,
  opts: PlayerCardFaceOptions = {},
): string {
  const profile = derivePlayerCardProfile(card);
  const name = escapeHtml(card.name);
  const radarSize = compact ? 56 : 96;
  const modeClass = compact ? "db-player-card--compact" : "db-player-card--full";
  const stateClass = [
    opts.ineligible ? "db-player-card--ineligible" : "db-player-card--clickable",
    opts.recommended ? "db-player-card--recommended" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return `
    <div class="db-player-card db-player-card--data ${modeClass} ${stateClass}" data-tier="${card.tier}" data-id="${card.playerId}" data-archetype="${escapeHtml(profile.archetype)}" title="${opts.ineligible ? "Cannot play this position" : "Tap for rating breakdown"}">
      <header class="db-card-top">
        <span class="db-ovr">${card.ovr}</span>
        <span class="db-pos">${card.position}</span>
      </header>
      <div class="db-card-viz" aria-hidden="true">
        ${attributeRadarSvg(card.attributes, radarSize)}
      </div>
      <div class="db-card-identity">
        <p class="db-card-archetype">${escapeHtml(profile.archetype)}</p>
        ${
          compact
            ? ""
            : `<p class="db-card-signature"><span class="db-card-sig-glyph">${signatureGlyph(profile.signature)}</span> ${escapeHtml(profile.signature)}</p>`
        }
      </div>
      <div class="db-name">${name}</div>
      ${
        compact
          ? `<div class="db-card-meta db-card-meta--tight">
        <span>${profile.workRate.attack[0]}/${profile.workRate.defense[0]}</span>
        <span>WF${profile.weakFoot}</span>
      </div>`
          : `<div class="db-card-meta">
        <span>WF ${starsHtml(profile.weakFoot)}</span>
        <span>SM ${starsHtml(profile.skillMoves)}</span>
        <span>${profile.workRate.attack}/${profile.workRate.defense}</span>
      </div>
      <div class="db-stats db-stats--compact">
        <span>PAC ${card.attributes.pac}</span><span>SHO ${card.attributes.sho}</span><span>PAS ${card.attributes.pas}</span>
        <span>DRI ${card.attributes.dri}</span><span>DEF ${card.attributes.def}</span><span>PHY ${card.attributes.phy}</span>
      </div>`
      }
    </div>`;
}

export function playerCardDetailHtml(card: RatedPlayerCard, profile?: PlayerCardProfile): string {
  const p = profile ?? derivePlayerCardProfile(card);
  const fits = p.formationFits
    .map(
      (f) =>
        `<div class="db-fit-row"><span>${f.formationId}</span><span class="db-fit-stars">${starsHtml(f.stars)}</span></div>`,
    )
    .join("");
  return `
    <div class="db-card-detail">
      <div class="db-card-detail__viz">
        ${attributeRadarSvg(card.attributes, 168, { labels: true })}
        <div class="db-card-detail__dna">
          <p class="db-hero__label">Football DNA</p>
          <p class="db-card-archetype db-card-archetype--lg">${escapeHtml(p.archetype)}</p>
          <p class="db-card-signature"><span class="db-card-sig-glyph">${signatureGlyph(p.signature)}</span> ${escapeHtml(p.signature)}</p>
          <p class="db-card-estimate-note">WF / skill / work rates are draft estimates from attributes — not licensed scouting fields.</p>
        </div>
      </div>
      <div class="db-card-detail__grid">
        <div>
          <p class="db-hero__label">Traits</p>
          <ul class="db-card-trait-list">
            <li>Weak Foot <strong>${starsHtml(p.weakFoot)}</strong></li>
            <li>Skill Moves <strong>${starsHtml(p.skillMoves)}</strong></li>
            <li>Work Rate <strong>${p.workRate.attack} / ${p.workRate.defense}</strong></li>
            <li>Fame tier <strong>${card.fameTier}</strong> <span class="db-muted">(visibility only)</span></li>
          </ul>
        </div>
        <div>
          <p class="db-hero__label">Formation fit</p>
          <div class="db-fit-list">${fits}</div>
        </div>
        <div class="db-card-detail__influence">
          <p class="db-hero__label">Match influence</p>
          ${influenceBar("Attack", p.influence.attack)}
          ${influenceBar("Press", p.influence.press)}
          ${influenceBar("Passing", p.influence.passing)}
          ${influenceBar("Defense", p.influence.defense)}
          ${influenceBar("Aerial", p.influence.aerial)}
        </div>
      </div>
      <div class="db-stats db-stats--modal">
        <span>PAC ${card.attributes.pac}</span><span>SHO ${card.attributes.sho}</span><span>PAS ${card.attributes.pas}</span>
        <span>DRI ${card.attributes.dri}</span><span>DEF ${card.attributes.def}</span><span>PHY ${card.attributes.phy}</span>
      </div>
    </div>`;
}
