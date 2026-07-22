import type { RatedPlayerCard } from "@sportverse/draftballer-types";
import { NO_POPULARITY_BONUS_RULE, lensBlend, FABRICATED_OVR_CAP } from "@sportverse/rating-engine";
import {
  competitionDisplayName,
  getSeasonStats,
  seasonContextLabel,
} from "@sportverse/sports-db";
import {
  attributeRadarSvg,
  playerCardDetailHtml,
  playerCardFaceHtml,
} from "../lib/player-card.js";

let overlayEl: HTMLElement | null = null;
let flipOverlayEl: HTMLElement | null = null;

const FLIP_MS = 720;
const FLIP_START_DELAY_MS = 140;

function radarSvg(attrs: RatedPlayerCard["attributes"], size = 160): string {
  return attributeRadarSvg(attrs, size, { labels: true });
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

function eaCalibrationHtml(bd: RatedPlayerCard["breakdown"]): string {
  if (bd.eaCalibrationOvr == null) return "";
  const prime = bd.eaPrimeUplift != null && bd.eaPrimeUplift > 0 ? ` · prime +${bd.eaPrimeUplift}` : "";
  const peak = bd.eaPeakUplift != null && bd.eaPeakUplift > 0 ? ` · stats peak +${Math.round(bd.eaPeakUplift * 0.45)}` : "";
  const basis =
    bd.ratingBasis === "ea_current"
      ? "EA FC 26 current snapshot (exact)"
      : "EA FC 26 calibrated floor";
  return `<div style="grid-column:1/-1" class="db-modal-section">
    <strong>EA FC 26 calibration</strong>
    <p style="font-size:0.85rem;color:var(--db-muted);margin:6px 0 0">
      ${basis} · EA current <strong style="color:var(--db-gold)">${bd.eaCalibrationOvr}</strong>${prime}${peak}
    </p>
  </div>`;
}

function ratingBasisHtml(bd: RatedPlayerCard["breakdown"]): string {
  const basis = bd.ratingBasis ?? "prime";
  if (basis === "ea_current") {
    return `<div style="grid-column:1/-1"><span class="db-stat-label">Rating basis</span><strong>EA FC 26 current snapshot</strong></div>`;
  }
  if (basis === "season" && bd.seasonLabel) {
    return `<div style="grid-column:1/-1"><span class="db-stat-label">Rating basis</span><strong>Rated as of ${bd.seasonLabel} season</strong></div>`;
  }
  return `<div style="grid-column:1/-1"><span class="db-stat-label">Rating basis</span><strong>Career peak, best-4-season window</strong></div>`;
}

function mvBlendHtml(bd: RatedPlayerCard["breakdown"]): string {
  if (bd.mvBlend == null || bd.mvBlend <= 0) return "";
  const delta = bd.mvBlendDelta ?? 0;
  const weightPct = Math.round((bd.mvBlendWeight ?? 0.2) * 100);
  const sign = delta >= 0 ? "+" : "";
  return `<div style="grid-column:1/-1" class="db-modal-section">
    <strong>Market-value scouting consensus</strong>
    <p style="font-size:0.85rem;color:var(--db-muted);margin:6px 0 0">
      ${sign}${delta.toFixed(1)} OVR · ${weightPct}% weight · era-normalized percentile <strong style="color:var(--db-gold)">${Math.round(bd.mvBlend)}</strong>
    </p>
  </div>`;
}

function fabricatedHtml(bd: RatedPlayerCard["breakdown"], confidence: number): string {
  if (!bd.fabricated) return "";
  const cap = bd.fabricatedCap ?? FABRICATED_OVR_CAP;
  return `<div style="grid-column:1/-1" class="db-modal-section">
    <strong>Limited data</strong>
    <p style="font-size:0.85rem;color:var(--db-muted);margin:6px 0 0">
      Attributes estimated from role archetype; capped at ${cap}, confidence ${confidence.toFixed(2)}
    </p>
  </div>`;
}

function legendHtml(bd: RatedPlayerCard["breakdown"]): string {
  if (!bd.legendOverride) return "";
  return `<div style="grid-column:1/-1" class="db-modal-section">
    <strong>Legend rating</strong>
    <p style="font-size:0.85rem;color:var(--db-muted);margin:6px 0 0">
      Hand-calibrated legend rating — see legend-ratings.json
    </p>
  </div>`;
}

function fameTierChip(card: RatedPlayerCard): string {
  const tier = card.fameTier ?? "obscure";
  return `<span class="db-fame-chip" title="Fame affects visibility in pools, never this rating">
    Fame ${tier} (${Math.round(card.fameScore ?? 0)}) — visibility only, never this rating
  </span>`;
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

export interface DraftPickInspectOptions {
  /** Show a primary confirm CTA (draft pick). */
  onConfirm?: () => void;
  confirmLabel?: string;
  onClose?: () => void;
  canConfirm?: boolean;
}

/**
 * Two-step draft inspect: raised flip card (face → detail), confirm via button.
 * Does not draft by itself — caller wires onConfirm.
 */
export function showDraftPickInspect(card: RatedPlayerCard, opts: DraftPickInspectOptions = {}): void {
  flipOverlayEl?.remove();
  const reduced =
    typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  flipOverlayEl = document.createElement("div");
  flipOverlayEl.className = "db-card-flip-overlay";
  flipOverlayEl.setAttribute("role", "dialog");
  flipOverlayEl.setAttribute("aria-modal", "true");
  flipOverlayEl.setAttribute("aria-label", `${card.name} player details`);
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  flipOverlayEl.innerHTML = `
    <div class="db-card-flip-stage${reduced ? " db-card-flip-stage--flipped" : ""}" data-flip-stage>
      <div class="db-card-flip-face db-card-flip-face--front">
        ${playerCardFaceHtml(card, false)}
        <p class="db-card-flip-cue">Inspecting…</p>
      </div>
      <div class="db-card-flip-face db-card-flip-face--back">
        <button type="button" class="db-card-flip-close btn btn--ghost" aria-label="Close">×</button>
        <p class="db-label-caps">Player card</p>
        <h2 class="db-card-flip-name">${esc(card.name)}</h2>
        <p class="db-card-flip-meta">${esc(card.position)} · OVR <strong>${card.ovr}</strong>${
          card.contextLine ? ` · ${esc(card.contextLine)}` : ""
        }</p>
        <div class="db-card-flip-scroll">
          ${playerCardDetailHtml(card)}
        </div>
        <div class="db-card-flip-actions">
          ${
            opts.onConfirm && opts.canConfirm !== false
              ? `<button type="button" class="db-btn-pitch" data-flip-confirm>${opts.confirmLabel ?? "Confirm Pick →"}</button>`
              : ""
          }
          <button type="button" class="btn btn--ghost" data-flip-more>Full rating breakdown</button>
          <button type="button" class="btn btn--ghost" data-flip-close>Back to board</button>
        </div>
      </div>
    </div>`;

  const close = () => {
    flipOverlayEl?.classList.add("db-card-flip-overlay--out");
    const node = flipOverlayEl;
    window.setTimeout(() => {
      node?.remove();
      if (flipOverlayEl === node) flipOverlayEl = null;
      opts.onClose?.();
    }, reduced ? 0 : 180);
  };

  flipOverlayEl.addEventListener("click", (e) => {
    if (e.target === flipOverlayEl) close();
  });
  flipOverlayEl.querySelectorAll("[data-flip-close], .db-card-flip-close").forEach((btn) => {
    btn.addEventListener("click", close);
  });
  flipOverlayEl.querySelector("[data-flip-confirm]")?.addEventListener("click", () => {
    close();
    opts.onConfirm?.();
  });
  flipOverlayEl.querySelector("[data-flip-more]")?.addEventListener("click", () => {
    close();
    window.setTimeout(() => showRatingBreakdown(card), reduced ? 0 : 200);
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

  document.body.appendChild(flipOverlayEl);
  // Force layout, then flip so the motion reads as a real card turn.
  if (!reduced) {
    const stage = flipOverlayEl.querySelector("[data-flip-stage]");
    requestAnimationFrame(() => {
      window.setTimeout(() => stage?.classList.add("db-card-flip-stage--flipped"), FLIP_START_DELAY_MS);
    });
  }
}

export function showRatingBreakdown(card: RatedPlayerCard, onClose?: () => void, pool?: RatedPlayerCard[]): void {
  overlayEl?.remove();
  const stats = getSeasonStats(card.playerId);
  const clubRows = stats.filter((s) => s.context === "CLUB").slice(0, 6);
  const intlRows = stats.filter((s) => s.context === "NATIONAL_TEAM").slice(0, 6);
  const bd = card.breakdown;
  const blendActive = bd.lens === "blended";
  const blendedOvr = instantBlendOvr(card, bd.blendFactor);

  overlayEl = document.createElement("div");
  overlayEl.className = "db-modal-overlay";
  overlayEl.innerHTML = `
    <div class="db-modal panel" role="dialog" aria-labelledby="breakdown-title">
      <button class="db-modal-close btn btn--ghost" type="button" aria-label="Close">×</button>
      <p class="db-hero__label" id="breakdown-title">Rating breakdown</p>
      <h2 class="db-modal-name">${card.name}</h2>
      <p class="db-modal-meta">${card.position} · OVR <strong style="color:var(--db-gold)" data-live-ovr>${card.ovr}</strong> · ${confidenceLabel(card.confidence)}</p>
      ${fameTierChip(card)}

      ${playerCardDetailHtml(card)}

      <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start;margin:12px 0">
        <div style="flex:1;min-width:180px">
          <label class="db-stat-label">Live lens blend (${Math.round(bd.blendFactor * 100)}% intl)</label>
          <input type="range" id="bd-blend" min="0" max="100" value="${Math.round(bd.blendFactor * 100)}" style="width:100%" ${blendActive ? "" : "disabled"} />
          <p style="font-size:0.8rem;color:var(--db-muted);margin-top:4px">
            ${
              blendActive
                ? `Instant OVR: <strong data-blend-ovr style="color:var(--db-gold)">${blendedOvr}</strong>`
                : `Blend applies only in <strong>blended</strong> lens (current: ${bd.lens.replace(/_/g, " ")}).`
            }
          </p>
          ${
            pool?.length
              ? `<label class="db-stat-label" style="margin-top:8px;display:block">Quick delta vs</label>
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
          <button class="btn btn--ghost btn--block" id="bd-compare-nav" type="button" style="margin-top:10px">Compare contexts →</button>
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
        ${ratingBasisHtml(bd)}
        ${eaCalibrationHtml(bd)}
        ${mvBlendHtml(bd)}
        ${fabricatedHtml(bd, card.confidence)}
        ${legendHtml(bd)}
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
                    ? `<p style="font-size:0.75rem;color:var(--db-muted)">${competitionDisplayName(bd.leagueContext.competitionId)} · ${bd.leagueContext.seasonLabel} · scale ${bd.leagueContext.scalingFactor} · shift ${bd.leagueContext.baselineShift >= 0 ? "+" : ""}${bd.leagueContext.baselineShift}</p>`
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
                  `<li>${seasonContextLabel(s)} · ${s.appearances} apps · ${s.goals}G ${s.assists}A</li>`,
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
    if (bd.lens !== "blended") return;
    const blend = Number((e.target as HTMLInputElement).value) / 100;
    const ovr = lensBlend(bd.clubOvrRaw, bd.intlOvrRaw, "blended", blend);
    const blendEl = overlayEl?.querySelector("[data-blend-ovr]");
    const liveEl = overlayEl?.querySelector("[data-live-ovr]");
    const blendLabel = overlayEl?.querySelector("label.db-stat-label");
    if (blendLabel) blendLabel.textContent = `Live lens blend (${Math.round(blend * 100)}% intl)`;
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

  overlayEl.querySelector("#bd-compare-nav")?.addEventListener("click", () => {
    close();
    location.hash = `#/draftballer/compare/${encodeURIComponent(card.playerId)}`;
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
      fameScore: 0,
      fameTier: "obscure",
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
    const target = e.target as HTMLElement;
    // Pick board owns its own flip-inspect flow.
    if (target.closest("#pick-pool, .db-pick-card, .db-card-flip-overlay")) return;
    const cardEl = target.closest(".db-player-card") as HTMLElement | null;
    if (!cardEl?.dataset.id) return;
    const card = poolMap.get(cardEl.dataset.id);
    if (card) showRatingBreakdown(card, undefined, pool);
  });
}
