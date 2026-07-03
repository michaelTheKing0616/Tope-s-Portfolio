import type { DraftModeConfig, RatedPlayerCard } from "@sportverse/draftballer-types";
import { computePoolCached, type RatingInput } from "@sportverse/rating-engine";
import { getDraftPlayers, getSeasonStats } from "@sportverse/sports-db";
import { buildFilteredPoolInputs, type EligibilityFilter } from "./mode-filters.js";

const LEGEND_OVERRIDES: Record<string, number> = {
  messi: 93,
  ronaldo: 92,
  mbappe: 91,
  haaland: 90,
  "de-bruyne": 91,
  modric: 89,
  benzema: 90,
  lewandowski: 90,
  maldini: 94,
  maradona: 95,
  pele: 96,
  zidane: 94,
  ronaldinho: 93,
  henry: 91,
  "van-dijk": 90,
  salah: 89,
  neymar: 89,
  bellingham: 88,
};

function enrichInput(p: RatingInput): RatingInput {
  return { ...p, manualOvr: LEGEND_OVERRIDES[p.id] };
}

export function buildDraftPool(
  mode: DraftModeConfig,
  eligibility: EligibilityFilter = {},
): RatedPlayerCard[] {
  const inputs = buildFilteredPoolInputs(mode, eligibility).map(enrichInput);
  return computePoolCached(inputs, mode);
}

export function poolSummary(cards: RatedPlayerCard[]) {
  const byPos: Record<string, number> = {};
  for (const c of cards) byPos[c.position] = (byPos[c.position] ?? 0) + 1;
  return {
    count: cards.length,
    top: cards.slice(0, 10),
    byPosition: byPos,
    avgOvr: cards.length ? Math.round(cards.reduce((s, c) => s + c.ovr, 0) / cards.length) : 0,
  };
}

/** Histogram for architect preview API. */
export function poolHistogram(cards: RatedPlayerCard[]) {
  const buckets = { bronze: 0, silver: 0, gold: 0, gold_plus: 0, prismatic: 0 };
  for (const c of cards) buckets[c.tier] = (buckets[c.tier] ?? 0) + 1;
  return buckets;
}

export function previewPool(mode: DraftModeConfig, eligibility: EligibilityFilter = {}) {
  const cards = buildDraftPool(mode, eligibility);
  return { ...poolSummary(cards), histogram: poolHistogram(cards) };
}
