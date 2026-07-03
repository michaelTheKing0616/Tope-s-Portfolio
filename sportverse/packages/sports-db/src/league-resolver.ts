import type { Club } from "./types.js";
import type { Competition } from "./extended-types.js";

const DOMESTIC_LEAGUE_IDS = new Set<string>();
let slugToLeague = new Map<string, string>();
let idToLeague = new Map<string, string>();
let initialized = false;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function registerClub(club: Club): void {
  if (!club.league) return;
  idToLeague.set(club.id, club.league);
  slugToLeague.set(slugify(club.name), club.league);
  const suffix = club.id.includes("-") ? club.id.split("-").slice(1).join("-") : club.id;
  slugToLeague.set(suffix, club.league);
}

export function seedLeagueResolver(clubs: Club[], competitions: Competition[]): void {
  DOMESTIC_LEAGUE_IDS.clear();
  slugToLeague = new Map();
  idToLeague = new Map();
  for (const c of competitions) {
    if (c.type === "domestic_league") DOMESTIC_LEAGUE_IDS.add(c.id);
  }
  for (const club of clubs) registerClub(club);
  initialized = true;
}

/** Map a season-stat competitionId (league slug or club slug) to a domestic league id. */
export function resolveCompetitionToLeague(competitionId: string): string | null {
  if (!initialized) return DOMESTIC_LEAGUE_IDS.has(competitionId) ? competitionId : null;
  if (DOMESTIC_LEAGUE_IDS.has(competitionId)) return competitionId;

  const direct = idToLeague.get(competitionId) ?? slugToLeague.get(competitionId);
  if (direct) return direct;

  for (const [clubId, league] of idToLeague) {
    if (clubId.endsWith(`-${competitionId}`) || clubId.includes(competitionId)) return league;
  }

  return null;
}

export function isDomesticLeagueId(competitionId: string): boolean {
  return DOMESTIC_LEAGUE_IDS.has(competitionId);
}

export function resetLeagueResolverForTests(): void {
  initialized = false;
  slugToLeague = new Map();
  idToLeague = new Map();
  DOMESTIC_LEAGUE_IDS.clear();
}
