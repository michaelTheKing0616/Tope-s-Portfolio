import type { EraContextConfig, EraProfile } from "@sportverse/draftballer-types";

/** Launch defaults — Simulation Intelligence Engine v2 §1.1 */
export const ERA_PROFILES: EraProfile[] = [
  {
    id: "1950s-60s",
    label: "1950s–60s",
    decade: "1950s",
    physicality_intensity: 0.85,
    tackling_leniency: 0.9,
    pitch_ball_quality: 0.3,
    tactical_sophistication: 0.3,
    tempo: 0.35,
    goals_per_game: 3.45,
    source: "curated",
  },
  {
    id: "1970s-80s",
    label: "1970s–80s (Hard Men)",
    decade: "1970s",
    physicality_intensity: 0.9,
    tackling_leniency: 0.85,
    pitch_ball_quality: 0.45,
    tactical_sophistication: 0.45,
    tempo: 0.45,
    goals_per_game: 2.55,
    source: "curated",
  },
  {
    id: "1990s",
    label: "1990s",
    decade: "1990s",
    physicality_intensity: 0.8,
    tackling_leniency: 0.65,
    pitch_ball_quality: 0.65,
    tactical_sophistication: 0.6,
    tempo: 0.55,
    goals_per_game: 2.6,
    source: "curated",
  },
  {
    id: "2000s",
    label: "2000s",
    decade: "2000s",
    physicality_intensity: 0.65,
    tackling_leniency: 0.45,
    pitch_ball_quality: 0.8,
    tactical_sophistication: 0.75,
    tempo: 0.65,
    goals_per_game: 2.55,
    source: "curated",
  },
  {
    id: "2010s",
    label: "2010s",
    decade: "2010s",
    physicality_intensity: 0.5,
    tackling_leniency: 0.25,
    pitch_ball_quality: 0.95,
    tactical_sophistication: 0.9,
    tempo: 0.8,
    goals_per_game: 2.7,
    source: "curated",
  },
  {
    id: "2020s",
    label: "2020s (Modern Neutral)",
    decade: "2020s",
    physicality_intensity: 0.45,
    tackling_leniency: 0.15,
    pitch_ball_quality: 1.0,
    tactical_sophistication: 0.95,
    tempo: 0.85,
    goals_per_game: 2.85,
    source: "curated",
  },
  {
    id: "1980s-serie-a",
    label: "1980s Serie A (Catenaccio)",
    decade: "1980s",
    region: "Italy",
    competitionId: "serie-a",
    physicality_intensity: 0.82,
    tackling_leniency: 0.75,
    pitch_ball_quality: 0.5,
    tactical_sophistication: 0.72,
    tempo: 0.4,
    goals_per_game: 2.05,
    source: "curated",
  },
  {
    id: "1974-world-cup",
    label: "1974 West Germany (World Cup)",
    decade: "1970s",
    region: "West Germany",
    physicality_intensity: 0.88,
    tackling_leniency: 0.82,
    pitch_ball_quality: 0.42,
    tactical_sophistication: 0.5,
    tempo: 0.48,
    goals_per_game: 2.55,
    source: "curated",
  },
];

const byId = new Map(ERA_PROFILES.map((p) => [p.id, p]));

export function getEraProfile(id: string): EraProfile {
  return byId.get(id) ?? byId.get("2020s")!;
}

export function resolveEraProfile(
  ctx: EraContextConfig,
  homeDraftDecade?: string,
  awayDraftDecade?: string,
): EraProfile {
  if (ctx.profileId) return getEraProfile(ctx.profileId);
  if (ctx.mode === "neutral_modern") return getEraProfile("2020s");
  if (ctx.mode === "historical_recreation" && ctx.decadeOrFixtureRef) {
    const hit = ERA_PROFILES.find(
      (p) => p.id === ctx.decadeOrFixtureRef || p.decade === ctx.decadeOrFixtureRef,
    );
    if (hit) return hit;
    return getEraProfile(ctx.decadeOrFixtureRef);
  }
  if (ctx.mode === "match_higher_draft") {
    const decades = [homeDraftDecade, awayDraftDecade].filter(Boolean) as string[];
    const pick = decades.sort()[0] ?? "2020s";
    const map: Record<string, string> = {
      "1990s": "1990s",
      "2000s": "2000s",
      "2010s": "2010s",
      "2020s": "2020s",
      "1980s": "1970s-80s",
      "1970s": "1970s-80s",
    };
    return getEraProfile(map[pick] ?? "2020s");
  }
  if (ctx.mode === "custom" && ctx.decadeOrFixtureRef) {
    return getEraProfile(ctx.decadeOrFixtureRef);
  }
  return getEraProfile("2020s");
}

export function listEraProfiles(): EraProfile[] {
  return ERA_PROFILES;
}
