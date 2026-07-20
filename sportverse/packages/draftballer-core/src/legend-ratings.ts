import type { PlayerAttributes } from "@sportverse/draftballer-types";

export interface LegendRatingEntry {
  playerId: string;
  ovr: number;
  attributes?: Partial<PlayerAttributes>;
}

let legendRatings = new Map<string, LegendRatingEntry>();

export function setLegendRatings(entries: LegendRatingEntry[]): void {
  legendRatings = new Map(entries.map((e) => [e.playerId, e]));
}

export function getLegendRating(playerId: string): LegendRatingEntry | undefined {
  return legendRatings.get(playerId);
}

export function hasLegendRating(playerId: string): boolean {
  return legendRatings.has(playerId);
}
