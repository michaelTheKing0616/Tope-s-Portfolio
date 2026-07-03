import type { RatedPlayerCard } from "@sportverse/draftballer-types";
import { NO_POPULARITY_BONUS_RULE, lensBlend } from "@sportverse/rating-engine";
import { getSeasonStats } from "@sportverse/sports-db";

let overlayEl: HTMLElement | null = null;
let compareCard: RatedPlayerCard | null = null;

function radarSvg(attrs: RatedPlayerCard["attributes"], size = 160): string {
  const keys: (keyof RatedPlayerCard["attributes"])[] = ["pac", "sho", "pas", "dri", "def", "phy"];
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  const rings = [0.25, 0.5, 0.75, 1].map(
    (f) =>
      `<polygon points="${keys
        .map((_, i) => {
          const a = (Math.PI * 2 * i) / keys.length - Math.PI / 2;
          return `${cx + Math.cos(a) * r * f},${cy + Math.sin(a) * r * f}`;
        })
        .join(" ")}" fill="none" stroke="rgba(255,255,255,0.08)" />`,
  );
  const pts = keys
    .map((k, i) => {
      const a = (Math.PI * 2 * i) / keys.length - Math.PI / 2;
      const v = attrs[k] / 99;
      return `${cx + Math.cos(a) * r * v},${cy + Math.sin(a) * r * v}`;
    })
    .join(" ");
  const labels = keys
    .map((k, i) => {
      const a = (Math.PI * 2 * i) / keys.length - Math.PI / 2;
      const lx = cx + Math.cos(a) * (r + 14);
      const ly = cy + Math.sin(a) * (r + 14);
      return `<text x="${lx}" y="${ly}" text-anchor="middle" fill="var(--db-muted)" font-size="9">${k.toUpperCase()}</text>`;
    })
    .join("");
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-label="Attribute radar">${rings.join("")}<polygon points="${pts}" fill="rgba(212,175,55,0.25)" stroke="var(--db-gold)" stroke-width="1.5"/>${labels}</svg>`;
}

function instantBlendOvr(card: RatedPlayerCard, blend: number): number {
  return lensBlend(card.breakdown.clubOvrRaw, card.breakdown.intlOvrRaw, card.breakdown.lens, blend);
}

function confidenceLabel(c: number): string {
  if (c >= 0.9) return "High — verified stats";
  if (c >= 0.75) return "Good — multiple seasons";
  if (c >= 0.65) return "Estimated — partial data";
  return "Low — limited records";
}

function microBreakdownHtml(
  micro: NonNullable<RatedPlayerCard["breakdown"]["microBreakdown"]>,
): string {
  const rows = Object.entries(micro)
    .filter(([, subs]) => Object.keys(subs).length > 0)
    .map(([macro, subs]) => {
      const subRows = Object.entries(subs)
        .map(([key, val]) => `<tr><td>${key}</td><td>${val}</td></tr>`)
        .join("");
      return `<tr class="db-micro-macro"><td colspan="2"><strong>${macro.toUpperCase()}</strong></td></tr>${subRows}`;
    })
    .join("");
  if (!rows) return "";
  return `
    <details class="db-micro-breakdown">
      <summary>Micro breakdown (sub-metric contributions)</summary>
      <table class="db-micro-table">
        <thead><tr><th>Metric</th><th>Contrib</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </details>`;
}

function gkAttributesHtml(gk: NonNullable<RatedPlayerCard["gkAttributes"]>): string {
  return `
    <div class="db-modal-section">
      <strong>Goalkeeper attributes</strong>
      <div class="db-stats db-stats--modal">
        <span>DIV ${gk.div}</span><span>HAN ${gk.han}</span><span>KIC ${gk.kic}</span>
        <span>REF ${gk.ref}</span><span>SPD ${gk.spd}</span><span>POS ${gk.pos}</span>
      </div>
    </div>`;
}

export function showRatingBreakdown(card: RatedPlayerCard, onClose?: () => void, pool?: RatedPlayerCard[]): void {
  overlayEl?.remove();
  const stats = getSeasonStats(card.playerId);
  const clubRows = stats.filter((s) => s.context === "CLUB").slice(0, 6);
  const intlRows = stats.filter((s) => s.context === "NATIONAL_TEAM").slice(0, 6);
  const bd = card.breakdown;
  const blendedOvr = instantBlendOvr(card, bd.blendFactor);

  overlayEl = document.createElement("div");
  overlayEl.className = "db-modal-overlay";
  overlayEl.innerHTML = `
    <div class="db-modal panel" role="dialog" aria-labelledby="breakdown-title">
      <button class="db-modal-close btn btn--ghost" type="button" aria-label="Close">×</button>
      <p class="db-hero__label" id="breakdown-title">Rating breakdown</p>
      <h2 class="db-modal-name">${card.name}</h2>
      <p class="db-modal-meta">${card.position} · OVR <strong style="color:var(--db-gold)" data-live-ovr>${card.ovr}</strong> · ${confidenceLabel(card.confidence)}</p>

      <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start;margin:12px 0">
        ${radarSvg(card.attributes)}
        <div style="flex:1;min-width:180px">
          <label class="db-stat-label">Live lens blend (${Math.round(bd.blendFactor * 100)}% intl)</label>
          <input type="range" id="bd-blend" min="0" max="100" value="${Math.round(bd.blendFactor * 100)}" style="width:100%" />
          <p style="font-size:0.8rem;color:var(--db-muted);margin-top:4px">Instant OVR: <strong data-blend-ovr style="color:var(--db-gold)">${blendedOvr}</strong></p>
          ${
            pool?.length
              ? `<label class="db-stat-label" style="margin-top:8px;display:block">Compare to</label>
                 <select id="bd-compare" class="btn btn--ghost btn--block">
                   <option value="">— select player —</option>
                   ${pool
                     .filter((p) => p.playerId !== card.playerId)
                     .slice(0, 80)
                     .map((p) => `<option value="${p.playerId}">${p.name} (${p.ovr})</option>`)
                     .join("")}
                 </select>
                 <div id="bd-compare-panel" style="margin-top:8px"></div>`
              : ""
          }
        </div>
      </div>

      <div class="db-breakdown-grid">
        <div><span class="db-stat-label">Club raw</span><strong>${bd.clubOvrRaw}</strong></div>
        <div><span class="db-stat-label">Intl raw</span><strong>${bd.intlOvrRaw}</strong></div>
        <div><span class="db-stat-label">Award bonus</span><strong>${bd.awardBonus >= 0 ? "+" : ""}${bd.awardBonus}</strong></div>
        <div><span class="db-stat-label">Longevity</span><strong>${bd.longevityBonus != null ? (bd.longevityBonus >= 0 ? "+" : "") + bd.longevityBonus : "—"}</strong></div>
        <div><span class="db-stat-label">Calibration</span><strong>${bd.calibrationNudge != null ? (bd.calibrationNudge >= 0 ? "+" : "") + bd.calibrationNudge : "—"}</strong></div>
        <div><span class="db-stat-label">Lens</span><strong>${bd.lens.replace(/_/g, " ")}</strong></div>
        <div><span class="db-stat-label">Blend</span><strong>${Math.round(bd.blendFactor * 100)}%</strong></div>
        ${bd.calibrationReason ? `<div style="grid-column:1/-1"><span class="db-stat-label">Calibration note</span><strong style="font-size:0.8rem">${bd.calibrationReason}</strong></div>` : ""}
        ${
          bd.leagueContext
            ? `<div style="grid-column:1/-1" class="db-modal-section">
                <strong>League Context</strong>
                <p style="font-size:0.85rem;color:var(--db-muted);margin:6px 0 0">
                  ${
                    bd.leagueContext.skipped
                      ? bd.leagueContext.confidenceLabel
                      : `Playing in a league measured at <strong style="color:var(--db-gold)">${bd.leagueContext.strengthIndex}</strong> strength (${bd.leagueContext.confidenceLabel}): <strong>${bd.leagueContext.pointSwing >= 0 ? "+" : ""}${bd.leagueContext.pointSwing}</strong> pts`
                  }
                </p>
                ${
                  !bd.leagueContext.skipped
                    ? `<p style="font-size:0.75rem;color:var(--db-muted)">${bd.leagueContext.competitionId} · ${bd.leagueContext.seasonLabel} · scale ${bd.leagueContext.scalingFactor} · shift ${bd.leagueContext.baselineShift >= 0 ? "+" : ""}${bd.leagueContext.baselineShift}</p>`
                    : ""
                }
              </div>`
            : ""
        }
      </div>

      <p class="db-popularity-rule">${NO_POPULARITY_BONUS_RULE}</p>

      <div class="db-stats db-stats--modal">
        <span>PAC ${card.attributes.pac}</span><span>SHO ${card.attributes.sho}</span><span>PAS ${card.attributes.pas}</span>
        <span>DRI ${card.attributes.dri}</span><span>DEF ${card.attributes.def}</span><span>PHY ${card.attributes.phy}</span>
      </div>

      ${card.gkAttributes ? gkAttributesHtml(card.gkAttributes) : ""}
      ${bd.microBreakdown ? microBreakdownHtml(bd.microBreakdown) : ""}

      ${
        clubRows.length
          ? `<div class="db-modal-section"><strong>Club seasons</strong><ul class="db-stat-list">${clubRows
              .map(
                (s) =>
                  `<li>${s.seasonLabel} · ${s.competitionId} · ${s.appearances} apps · ${s.goals}G ${s.assists}A</li>`,
              )
              .join("")}</ul></div>`
          : ""
      }
      ${
        intlRows.length
          ? `<div class="db-modal-section"><strong>International</strong><ul class="db-stat-list">${intlRows
              .map(
                (s) =>
                  `<li>${s.seasonLabel} · ${s.appearances} apps · ${s.goals}G · conf ${Math.round(s.confidence * 100)}%</li>`,
              )
              .join("")}</ul></div>`
          : ""
      }
    </div>`;

  const close = () => {
    overlayEl?.remove();
    overlayEl = null;
    onClose?.();
  };

  overlayEl.querySelector(".db-modal-close")?.addEventListener("click", close);
  overlayEl.addEventListener("click", (e) => {
    if (e.target === overlayEl) close();
  });
  document.addEventListener(
    "keydown",
    function esc(ev) {
      if (ev.key === "Escape") {
        close();
        document.removeEventListener("keydown", esc);
      }
    },
    { once: true },
  );

  overlayEl.querySelector("#bd-blend")?.addEventListener("input", (e) => {
    const blend = Number((e.target as HTMLInputElement).value) / 100;
    const ovr = lensBlend(bd.clubOvrRaw, bd.intlOvrRaw, bd.lens, blend);
    const blendEl = overlayEl?.querySelector("[data-blend-ovr]");
    const liveEl = overlayEl?.querySelector("[data-live-ovr]");
    if (blendEl) blendEl.textContent = String(ovr);
    if (liveEl) liveEl.textContent = String(ovr);
  });

  overlayEl.querySelector("#bd-compare")?.addEventListener("change", (e) => {
    const id = (e.target as HTMLSelectElement).value;
    const panel = overlayEl?.querySelector("#bd-compare-panel");
    if (!panel || !pool) return;
    const other = pool.find((p) => p.playerId === id);
    if (!other) {
      panel.innerHTML = "";
      return;
    }
    panel.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center">
        ${radarSvg(other.attributes, 100)}
        <div>
          <strong>${other.name}</strong><br/>
          <span style="color:var(--db-gold)">OVR ${other.ovr}</span>
          <p style="font-size:0.75rem;color:var(--db-muted);margin-top:4px">Δ OVR ${other.ovr - card.ovr >= 0 ? "+" : ""}${other.ovr - card.ovr}</p>
        </div>
      </div>`;
  });

  document.body.appendChild(overlayEl);
}

export function bindPlayerCardBreakdowns(root: HTMLElement): void {
  root.addEventListener("click", (e) => {
    const cardEl = (e.target as HTMLElement).closest(".db-player-card") as HTMLElement | null;
    if (!cardEl?.dataset.id) return;
    const id = cardEl.dataset.id;
    const ovr = Number(cardEl.querySelector(".db-ovr")?.textContent ?? 0);
    const pos = cardEl.querySelector(".db-pos")?.textContent ?? "CM";
    const name = cardEl.querySelector(".db-name")?.textContent ?? id;
    const tier = (cardEl.dataset.tier ?? "bronze") as RatedPlayerCard["tier"];
    const statSpans = cardEl.querySelectorAll(".db-stats span");
    const parse = (label: string) =>
      Number([...statSpans].find((s) => s.textContent?.startsWith(label))?.textContent?.replace(label, "") ?? 50);
    showRatingBreakdown({
      playerId: id,
      name,
      nationality: "—",
      position: pos as RatedPlayerCard["position"],
      ovr,
      tier,
      confidence: 0.8,
      attributes: {
        pac: parse("PAC "),
        sho: parse("SHO "),
        pas: parse("PAS "),
        dri: parse("DRI "),
        def: parse("DEF "),
        phy: parse("PHY "),
      },
      breakdown: {
        clubOvrRaw: ovr,
        intlOvrRaw: ovr - 3,
        awardBonus: 0,
        lens: "club_only",
        blendFactor: 0,
      },
    });
  });
}

export function bindPlayerCardBreakdownsWithPool(root: HTMLElement, pool: RatedPlayerCard[]): void {
  const poolMap = new Map(pool.map((p) => [p.playerId, p]));
  root.addEventListener("click", (e) => {
    const cardEl = (e.target as HTMLElement).closest(".db-player-card") as HTMLElement | null;
    if (!cardEl?.dataset.id) return;
    const card = poolMap.get(cardEl.dataset.id);
    if (card) showRatingBreakdown(card, undefined, pool);
  });
}
