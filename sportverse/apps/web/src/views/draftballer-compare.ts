import type { DraftModeConfig, RatedPlayerCard, RatingLens } from "@sportverse/draftballer-types";
import { getPresetMode, PRESET_MODES, ratePlayerById } from "@sportverse/draftballer-core";
import { getDraftPlayers, searchPlayers } from "@sportverse/sports-db";
import { playerCardHtml } from "./draftballer-hub.js";
import { bindPlayerCardBreakdownsWithPool, showRatingBreakdown } from "./draftballer-breakdown.js";

type Navigate = (route: string, param?: string) => void;

interface SideState {
  playerId: string;
  lens: RatingLens;
  blendFactor: number;
  ratingBasis: "prime" | "season";
  year: number;
  query: string;
}

function attrRows(card: RatedPlayerCard): string {
  const a = card.attributes;
  return `PAC ${a.pac} · SHO ${a.sho} · PAS ${a.pas} · DRI ${a.dri} · DEF ${a.def} · PHY ${a.phy}`;
}

function playerLabel(id: string): string {
  return getDraftPlayers().find((p) => p.id === id)?.name ?? id;
}

function searchHits(query: string, selectedId: string): { id: string; name: string }[] {
  const q = query.trim();
  if (q.length >= 2) {
    const hits = searchPlayers(q, 40).map((p) => ({ id: p.id, name: p.name }));
    if (!hits.some((h) => h.id === selectedId)) {
      hits.unshift({ id: selectedId, name: playerLabel(selectedId) });
    }
    return hits;
  }
  // Empty / short query: show selected + a small alphabetical seed (not the full 98k).
  const seed = getDraftPlayers()
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 24)
    .map((p) => ({ id: p.id, name: p.name }));
  if (!seed.some((h) => h.id === selectedId)) {
    seed.unshift({ id: selectedId, name: playerLabel(selectedId) });
  }
  return seed;
}

function sidePanelHtml(side: "a" | "b", state: SideState, card: RatedPlayerCard | null): string {
  const hits = searchHits(state.query, state.playerId);
  return `
    <div class="panel db-compare-side" data-side="${side}">
      <label class="db-stat-label" for="compare-q-${side}">Search player</label>
      <input
        id="compare-q-${side}"
        class="btn btn--ghost btn--block db-compare-search"
        type="search"
        autocomplete="off"
        placeholder="Type 2+ letters…"
        value="${state.query.replace(/"/g, "&quot;")}"
        data-field="query"
      />
      <label class="db-stat-label" style="margin-top:8px;display:block">Results</label>
      <select class="btn btn--ghost btn--block" data-field="playerId" size="${Math.min(8, Math.max(3, hits.length))}">
        ${hits
          .map(
            (p) =>
              `<option value="${p.id}" ${p.id === state.playerId ? "selected" : ""}>${p.name}</option>`,
          )
          .join("")}
      </select>
      <p class="db-compare-hint">${
        state.query.trim().length >= 2
          ? `${hits.length} match${hits.length === 1 ? "" : "es"} across the full archive`
          : "Type to search the full player archive"
      }</p>
      <label class="db-stat-label" style="margin-top:8px;display:block">Lens</label>
      <select class="btn btn--ghost btn--block" data-field="lens">
        ${(["club_only", "international_only", "blended", "best_context"] as RatingLens[])
          .map(
            (l) =>
              `<option value="${l}" ${l === state.lens ? "selected" : ""}>${l.replace(/_/g, " ")}</option>`,
          )
          .join("")}
      </select>
      <label class="db-stat-label" style="margin-top:8px;display:block">Intl blend (${Math.round(state.blendFactor * 100)}%)</label>
      <input type="range" min="0" max="100" value="${Math.round(state.blendFactor * 100)}" data-field="blendFactor" style="width:100%" ${state.lens === "blended" ? "" : "disabled"} />
      ${
        state.lens !== "blended"
          ? `<p class="db-compare-hint">Blend applies only when lens is <strong>blended</strong>.</p>`
          : ""
      }
      <label class="db-stat-label" style="margin-top:8px;display:block">Basis</label>
      <select class="btn btn--ghost btn--block" data-field="ratingBasis">
        <option value="prime" ${state.ratingBasis === "prime" ? "selected" : ""}>Career peak</option>
        <option value="season" ${state.ratingBasis === "season" ? "selected" : ""}>Single season</option>
      </select>
      <label class="db-stat-label" style="margin-top:8px;display:block">Season year</label>
      <input class="btn btn--ghost btn--block" type="number" min="1950" max="2026" value="${state.year}" data-field="year" />
      ${
        card
          ? `<div class="db-compare-card" style="margin-top:12px">
              ${playerCardHtml(card, false)}
              <p style="font-size:0.8rem;color:var(--db-muted);margin-top:8px">${attrRows(card)}</p>
              <p style="font-size:0.75rem;color:var(--db-muted)">${card.breakdown.ratingBasis === "season" && card.breakdown.seasonLabel ? `Rated as of ${card.breakdown.seasonLabel}` : "Career peak"} · ${card.breakdown.lens.replace(/_/g, " ")}</p>
              <button class="btn btn--ghost btn--block" type="button" data-breakdown="${card.playerId}" style="margin-top:8px">Full breakdown</button>
            </div>`
          : `<p style="color:var(--db-muted);margin-top:12px">Player not found in pool.</p>`
      }
    </div>`;
}

function modeFromSide(state: SideState, base: DraftModeConfig): DraftModeConfig {
  return {
    ...base,
    id: `compare-${state.playerId}-${state.lens}`,
    ratingLens: state.lens,
    blendFactor: state.blendFactor,
    ratingBasis: state.ratingBasis,
    year: state.ratingBasis === "season" ? state.year : base.year,
  };
}

export function renderDraftballerCompare(root: HTMLElement, navigate: Navigate, param?: string) {
  const parts = (param ?? "").split("/").filter(Boolean).map(decodeURIComponent);
  const defaultId = getDraftPlayers()[0]?.id ?? "messi";
  const idA = parts[0] || defaultId;
  const idB = parts[1] || idA;

  const clubMode = getPresetMode("club-only");
  const intlMode = getPresetMode("international");

  let sideA: SideState = {
    playerId: idA,
    lens: clubMode.ratingLens,
    blendFactor: clubMode.blendFactor,
    ratingBasis: "prime",
    year: 2004,
    query: "",
  };
  let sideB: SideState = {
    playerId: idB,
    lens: intlMode.ratingLens,
    blendFactor: intlMode.blendFactor,
    ratingBasis: "prime",
    year: 2004,
    query: "",
  };

  if (!parts[1] && parts[0]) {
    sideB = { ...sideB, playerId: idA, lens: "international_only", blendFactor: 1 };
  }

  let searchTimer: ReturnType<typeof setTimeout> | null = null;

  const draw = (focusSide?: "a" | "b") => {
    const cardA = ratePlayerById(sideA.playerId, modeFromSide(sideA, PRESET_MODES[0]!));
    const cardB = ratePlayerById(sideB.playerId, modeFromSide(sideB, PRESET_MODES[0]!));
    const delta = cardA && cardB ? cardA.ovr - cardB.ovr : 0;

    root.innerHTML = `
      <div class="shell db-root">
        <button class="btn btn--ghost" id="back" type="button">← Hub</button>
        <header class="db-hero">
          <p class="db-hero__label">Compare</p>
          <h1 class="db-hero__title">CONTEXT VS CONTEXT</h1>
          <p style="color:var(--db-muted);max-width:48ch;margin:0 auto">
            Same engine, different lens — club vs international, peak vs season. Offline.
          </p>
          ${
            cardA && cardB
              ? `<p style="margin-top:12px;font-size:1.1rem">Δ OVR <strong style="color:var(--db-gold)">${delta >= 0 ? "+" : ""}${delta}</strong> (A − B)</p>`
              : ""
          }
        </header>
        <div class="db-compare-grid">
          ${sidePanelHtml("a", sideA, cardA)}
          ${sidePanelHtml("b", sideB, cardB)}
        </div>
      </div>`;

    const pool = [cardA, cardB].filter(Boolean) as RatedPlayerCard[];
    bindPlayerCardBreakdownsWithPool(root, pool);

    root.querySelector("#back")?.addEventListener("click", () => navigate("draftballer"));

    root.querySelectorAll(".db-compare-side").forEach((panel) => {
      const side = (panel as HTMLElement).dataset.side as "a" | "b";
      const apply = (field: string, value: string, redraw = true) => {
        const target = side === "a" ? sideA : sideB;
        if (field === "playerId") target.playerId = value;
        else if (field === "query") target.query = value;
        else if (field === "lens") {
          target.lens = value as RatingLens;
          target.blendFactor =
            value === "club_only" ? 0 : value === "international_only" ? 1 : target.blendFactor;
        } else if (field === "blendFactor") {
          if (target.lens !== "blended") return;
          target.blendFactor = Number(value) / 100;
        }
        else if (field === "ratingBasis") target.ratingBasis = value as "prime" | "season";
        else if (field === "year") target.year = Number(value) || 2004;
        if (side === "a") sideA = { ...target };
        else sideB = { ...target };
        if (field === "playerId") {
          const path = `${encodeURIComponent(sideA.playerId)}/${encodeURIComponent(sideB.playerId)}`;
          history.replaceState(null, "", `#/draftballer/compare/${path}`);
        }
        if (redraw) draw(field === "query" ? side : undefined);
      };

      const searchInput = panel.querySelector("input[data-field=query]") as HTMLInputElement | null;
      searchInput?.addEventListener("input", () => {
        const value = searchInput.value;
        if (side === "a") sideA = { ...sideA, query: value };
        else sideB = { ...sideB, query: value };
        if (searchTimer) clearTimeout(searchTimer);
        searchTimer = setTimeout(() => apply("query", value, true), 120);
      });

      panel.querySelectorAll("select[data-field], input[data-field]:not([data-field=query])").forEach((el) => {
        const field = (el as HTMLElement).dataset.field!;
        el.addEventListener("change", () => apply(field, (el as HTMLInputElement).value));
        if (el instanceof HTMLInputElement && el.type === "range") {
          el.addEventListener("input", () => apply(field, el.value));
        }
      });
    });

    root.querySelectorAll("[data-breakdown]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = (btn as HTMLElement).dataset.breakdown!;
        const card = pool.find((c) => c.playerId === id);
        if (card) showRatingBreakdown(card, undefined, pool);
      });
    });

    if (focusSide) {
      const el = root.querySelector(`#compare-q-${focusSide}`) as HTMLInputElement | null;
      if (el) {
        el.focus();
        const len = el.value.length;
        el.setSelectionRange(len, len);
      }
    }
  };

  draw();
}
