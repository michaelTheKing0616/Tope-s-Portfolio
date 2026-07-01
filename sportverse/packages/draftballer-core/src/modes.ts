import type { DraftModeConfig } from "@sportverse/draftballer-types";

export const PRESET_MODES: DraftModeConfig[] = [
  {
    id: "all-time-any",
    title: "All-Time · Any League",
    blurb: "Peak-weighted careers across every league.",
    era: "all_time",
    competitionScope: "any_league",
    ratingLens: "club_only",
    blendFactor: 0,
  },
  {
    id: "club-only",
    title: "Club Version",
    blurb: "Ratings from club competitions only.",
    era: "all_time",
    competitionScope: "any_league",
    ratingLens: "club_only",
    blendFactor: 0,
  },
  {
    id: "international",
    title: "International Version",
    blurb: "National team performance only.",
    era: "all_time",
    competitionScope: "international",
    ratingLens: "international_only",
    blendFactor: 1,
  },
  {
    id: "premier-league",
    title: "Premier League",
    blurb: "All-time Premier League legends.",
    era: "all_time",
    competitionScope: "single_league",
    ratingLens: "club_only",
    blendFactor: 0,
    leagueId: "premier-league",
  },
  {
    id: "decade-2010s",
    title: "2010s Decade",
    blurb: "Best of the 2010s across competitions.",
    era: "decade",
    competitionScope: "any_league",
    ratingLens: "blended",
    blendFactor: 0.35,
    decade: "2010s",
  },
  {
    id: "custom",
    title: "Draft Architect",
    blurb: "Build your own era, scope, and rating lens.",
    era: "all_time",
    competitionScope: "any_league",
    ratingLens: "blended",
    blendFactor: 0.35,
  },
];

export function getPresetMode(id: string): DraftModeConfig {
  return PRESET_MODES.find((m) => m.id === id) ?? PRESET_MODES[0]!;
}
