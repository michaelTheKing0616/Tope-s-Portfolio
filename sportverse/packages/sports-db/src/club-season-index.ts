import type { DraftModeConfig } from "@sportverse/draftballer-types";
import type { PlayerSeasonStat } from "./extended-types.js";
import type { Club } from "./types.js";
import { getFameScore } from "./fame.js";

export interface ClubSeasonKey {
  clubId: string;
  clubName: string;
  seasonLabel: string;
  playerIds: string[];
  fameSum: number;
}

let clubSeasonIndex: Map<string, ClubSeasonKey> | null = null;
/** Prebuilt from archive performances (team_name × season) — preferred source. */
let prebuiltRosters: ClubSeasonKey[] | null = null;

function indexKey(clubName: string, seasonLabel: string): string {
  return `${clubName}::${seasonLabel}`;
}

function seasonInModeRange(seasonLabel: string, mode: DraftModeConfig): boolean {
  const y = Number(String(seasonLabel).replace(/\/.*/, ""));
  if (mode.era === "single_year" && mode.year) {
    return seasonLabel === String(mode.year) || String(seasonLabel).startsWith(String(mode.year));
  }
  if (mode.era === "decade" && mode.decade) {
    const decade = mode.decade;
    if (decade === "1990s") return y >= 1990 && y < 2000;
    if (decade === "2000s") return y >= 2000 && y < 2010;
    if (decade === "2010s") return y >= 2010 && y < 2020;
    if (decade === "2020s") return y >= 2020;
  }
  if (mode.era === "custom_range" && mode.yearFrom != null && mode.yearTo != null) {
    return Number.isFinite(y) && y >= mode.yearFrom && y <= mode.yearTo;
  }
  return true;
}

/** True when a string looks like a Transfermarkt competition id, not a club name. */
export function looksLikeCompetitionId(name: string): boolean {
  const s = name.trim().toLowerCase();
  if (!s) return true;
  // Transfermarkt competition / team codes (tm-frch, tm-cgb, "tm nlsc")
  if (/^tm[\s_-]/i.test(s)) return true;
  if (/^[a-z]{2,3}-\d+$/i.test(s)) return true;
  // Short league codes like es1, it1, fr1, gb1
  if (/^[a-z]{2}\d+$/i.test(s)) return true;
  if (s.includes("competition") || s.startsWith("comp-")) return true;
  if (/\b(u\d{2}|u-\d{2}|youth|reserves|primavera|under\s*\d+)\b/i.test(s)) return true;
  const leagueLike = new Set([
    "premier-league",
    "la-liga",
    "serie-a",
    "bundesliga",
    "ligue-1",
    "eredivisie",
    "primeira-liga",
    "championship",
    "world-cup",
    "champions-league",
    "europa-league",
    "international",
  ]);
  if (leagueLike.has(s)) return true;
  return false;
}

/**
 * Resolve club for a season-stat row.
 * Prefer explicit clubName on the row (future ETL); else club-slug competitionIds
 * (curated career rows). Never map league → club.
 */
function clubNameForStat(
  stat: PlayerSeasonStat & { clubName?: string },
  playerClubs: string[] | undefined,
  clubSlugToName: Map<string, string>,
): string | null {
  // Prefer explicit clubName from performances ETL / enrich pass.
  if (stat.clubName && !looksLikeCompetitionId(stat.clubName)) return stat.clubName;

  const fromSlug = clubSlugToName.get(stat.competitionId.toLowerCase().replace(/\s+/g, "-"));
  if (fromSlug && !looksLikeCompetitionId(fromSlug)) return fromSlug;

  if (playerClubs?.length) {
    const slug = stat.competitionId.toLowerCase().replace(/\s+/g, "-");
    const match = playerClubs.find((c) => c.toLowerCase().replace(/\s+/g, "-") === slug);
    if (match && !looksLikeCompetitionId(match)) return match;
  }

  if (looksLikeCompetitionId(stat.competitionId)) return null;
  // Bare competitionId only if it looks like a human club name.
  if (/[ A-Z]/.test(stat.competitionId) || /\b(fc|cf|afc|sc)\b/i.test(stat.competitionId)) {
    return stat.competitionId;
  }
  // Curated slug without spaces (barcelona, real-madrid)
  if (/^[a-z][a-z0-9-]{2,}$/i.test(stat.competitionId) && !/^[a-z]{2}\d+$/i.test(stat.competitionId)) {
    return clubSlugToName.get(stat.competitionId.toLowerCase()) ?? titleCaseSlug(stat.competitionId);
  }
  return null;
}

function titleCaseSlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function finalizeEntry(clubName: string, seasonLabel: string, playerIds: string[]): ClubSeasonKey | null {
  if (looksLikeCompetitionId(clubName)) return null;
  const famousCount = playerIds.filter((id) => getFameScore(id) >= 55).length;
  if (playerIds.length < 14 || playerIds.length > 40 || famousCount < 3) return null;
  const fameSum = playerIds.reduce((s, id) => s + getFameScore(id), 0);
  return {
    clubId: clubName.toLowerCase().replace(/\s+/g, "-"),
    clubName,
    seasonLabel,
    playerIds,
    fameSum,
  };
}

/** Inject archive-built rosters (preferred). Call before or after rebuildClubSeasonIndex. */
export function setPrebuiltClubSeasons(entries: ClubSeasonKey[] | null): void {
  prebuiltRosters = entries?.length ? entries : null;
  if (clubSeasonIndex) {
    // Re-merge into existing index when already built from stats.
    mergePrebuiltInto(clubSeasonIndex);
  }
}

function mergePrebuiltInto(index: Map<string, ClubSeasonKey>): void {
  if (!prebuiltRosters) return;
  for (const e of prebuiltRosters) {
    if (looksLikeCompetitionId(e.clubName)) continue;
    if (e.playerIds.length < 14 || e.playerIds.length > 40) continue;
    index.set(indexKey(e.clubName, e.seasonLabel), {
      ...e,
      fameSum: e.fameSum || e.playerIds.reduce((s, id) => s + getFameScore(id), 0),
    });
  }
}

export function rebuildClubSeasonIndex(
  statsByPlayer: Map<string, PlayerSeasonStat[]>,
  clubsExtended: Club[],
  playerClubsById: Map<string, string[]>,
): void {
  // Club id / name slug → display name only. NEVER league → club.
  const clubSlugToName = new Map<string, string>();
  for (const c of clubsExtended) {
    clubSlugToName.set(c.id, c.name);
    clubSlugToName.set(c.name.toLowerCase().replace(/\s+/g, "-"), c.name);
  }

  const squadByKey = new Map<string, Set<string>>();
  for (const [playerId, stats] of statsByPlayer) {
    const clubs = playerClubsById.get(playerId);
    for (const s of stats) {
      if (s.context !== "CLUB") continue;
      const clubName = clubNameForStat(s, clubs, clubSlugToName);
      if (!clubName) continue;
      const key = indexKey(clubName, s.seasonLabel);
      let set = squadByKey.get(key);
      if (!set) {
        set = new Set();
        squadByKey.set(key, set);
      }
      set.add(playerId);
    }
  }

  const index = new Map<string, ClubSeasonKey>();
  for (const [key, playerSet] of squadByKey) {
    const sep = key.indexOf("::");
    const clubName = key.slice(0, sep);
    const seasonLabel = key.slice(sep + 2);
    const entry = finalizeEntry(clubName, seasonLabel, [...playerSet]);
    if (entry) index.set(key, entry);
  }

  mergePrebuiltInto(index);
  clubSeasonIndex = index;
}

export function resetClubSeasonIndex(): void {
  clubSeasonIndex = null;
}

export function listSpinnableClubSeasons(mode: DraftModeConfig): ClubSeasonKey[] {
  if (!clubSeasonIndex) return [];
  const out: ClubSeasonKey[] = [];
  for (const entry of clubSeasonIndex.values()) {
    if (!seasonInModeRange(entry.seasonLabel, mode)) continue;
    if (mode.competitionScope === "single_league" && mode.leagueId) {
      // league filter applied loosely — club metadata may not always have league
    }
    out.push(entry);
  }
  return out.sort((a, b) => b.fameSum - a.fameSum);
}

export function getClubSeasonSquad(clubName: string, seasonLabel: string): string[] {
  return clubSeasonIndex?.get(indexKey(clubName, seasonLabel))?.playerIds ?? [];
}

export function getClubSeasonEntry(clubName: string, seasonLabel: string): ClubSeasonKey | undefined {
  return clubSeasonIndex?.get(indexKey(clubName, seasonLabel));
}
