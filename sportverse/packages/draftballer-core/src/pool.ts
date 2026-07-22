import type { DraftModeConfig, RatedPlayerCard, Position } from "@sportverse/draftballer-types";
import { computePlayerRating, computePoolCached, type RatingInput } from "@sportverse/rating-engine";
import { getPlayer, getSeasonStats } from "@sportverse/sports-db";
import { buildFilteredPoolInputs, type EligibilityFilter } from "./mode-filters.js";
import { createRng } from "./rng.js";
import { getLegendRating } from "./legend-ratings.js";

export type { LegendRatingEntry } from "./legend-ratings.js";
export { setLegendRatings } from "./legend-ratings.js";

function enrichInput(p: RatingInput): RatingInput {
  const legend = getLegendRating(p.id);
  if (!legend) return p;
  return {
    ...p,
    manualOvr: legend.ovr,
    manualAttributes: legend.attributes,
  };
}

/** Rate a single player under an arbitrary mode (compare view / offline). */
export function ratePlayerById(playerId: string, mode: DraftModeConfig): RatedPlayerCard | null {
  const p = getPlayer(playerId);
  if (!p) return null;
  const input = enrichInput({
    id: p.id,
    name: p.name,
    nationality: p.nationality,
    position: p.position,
    clubs: p.clubs,
    seasonStats: getSeasonStats(p.id),
    seasonLabel: mode.ratingBasis === "season" && mode.year != null ? String(mode.year) : undefined,
  });
  return computePlayerRating(input, mode);
}

/**
 * Season-correct rating for historical challengers (e.g. "05/06").
 * Falls back to peak/all-time card when season stats are missing.
 */
export function ratePlayerByIdForSeason(
  playerId: string,
  seasonLabel: string,
  mode: DraftModeConfig,
): RatedPlayerCard | null {
  const p = getPlayer(playerId);
  if (!p) return null;
  const seasonMode: DraftModeConfig = { ...mode, ratingBasis: "season" };
  const input = enrichInput({
    id: p.id,
    name: p.name,
    nationality: p.nationality,
    position: p.position,
    clubs: p.clubs,
    seasonStats: getSeasonStats(p.id),
    seasonLabel,
  });
  const seasonal = computePlayerRating(input, seasonMode);
  // If season basis produced a near-empty card, keep all-time as fallback.
  if (seasonal.ovr < 45 && (input.seasonStats?.length ?? 0) > 0) {
    return ratePlayerById(playerId, mode) ?? seasonal;
  }
  return seasonal;
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

export function poolHistogram(cards: RatedPlayerCard[]) {
  const buckets = { bronze: 0, silver: 0, gold: 0, gold_plus: 0, prismatic: 0 };
  for (const c of cards) buckets[c.tier] = (buckets[c.tier] ?? 0) + 1;
  return buckets;
}

export function previewPool(mode: DraftModeConfig, eligibility: EligibilityFilter = {}) {
  const cards = buildDraftPool(mode, eligibility);
  return { ...poolSummary(cards), histogram: poolHistogram(cards) };
}

/** Fame-stratified seeded sample for classic room UI grids. */
export function samplePoolForRoom(
  pool: RatedPlayerCard[],
  seed: string,
  perPosition = 12,
): RatedPlayerCard[] {
  const rng = createRng(`${seed}:room-grid`);
  const groups: Partial<Record<Position, RatedPlayerCard[]>> = {};
  for (const card of pool) {
    const list = groups[card.position] ?? [];
    list.push(card);
    groups[card.position] = list;
  }
  const out: RatedPlayerCard[] = [];
  for (const pos of Object.keys(groups) as Position[]) {
    const list = groups[pos] ?? [];
    const weight = (c: RatedPlayerCard) => Math.max(1, c.fameScore ?? 0);
    out.push(...rng.weightedSample(list, weight, Math.min(perPosition, list.length)));
  }
  return rng.shuffle(out);
}
