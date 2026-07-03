import type { DraftModeConfig, RatedPlayerCard } from "@sportverse/draftballer-types";
import type { RatingInput } from "./compute.js";
import { computePool } from "./compute.js";

const cache = new Map<string, { cards: RatedPlayerCard[]; at: number }>();
const TTL_MS = 15 * 60 * 1000;

export function modeCacheKey(mode: DraftModeConfig): string {
  return JSON.stringify({
    id: mode.id,
    era: mode.era,
    decade: mode.decade,
    year: mode.year,
    competitionScope: mode.competitionScope,
    leagueId: mode.leagueId,
    ratingLens: mode.ratingLens,
    blendFactor: Math.round(mode.blendFactor * 100),
    minAppearances: (mode as DraftModeConfig & { minAppearances?: number }).minAppearances ?? 0,
  });
}

/** Precompute / cache rated pool for a mode preset (bible §4.7). */
export function computePoolCached(
  players: RatingInput[],
  mode: DraftModeConfig,
  filteredIds?: string[],
): RatedPlayerCard[] {
  const key = `${modeCacheKey(mode)}|${filteredIds?.length ?? players.length}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.cards;

  const inputs = filteredIds
    ? players.filter((p) => filteredIds.includes(p.id))
    : players;
  const cards = computePool(inputs, mode);
  cache.set(key, { cards, at: Date.now() });
  return cards;
}

export function clearPoolCache(): void {
  cache.clear();
}

export function poolCacheStats() {
  return { entries: cache.size };
}
