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

/**
 * Domestic leagues casual fans recognize — top flights + well-known second tiers.
 * Not every domestic_league id (youth / obscure tm-* tiers stay out).
 */
export const WHEEL_RECOGNIZED_LEAGUE_IDS = new Set([
  // Big 5
  "premier-league",
  "la-liga",
  "serie-a",
  "bundesliga",
  "ligue-1",
  // Known European first divisions
  "championship",
  "eredivisie",
  "primeira-liga",
  "super-lig",
  "scottish-premiership",
  "pro-league",
  // Known second tiers
  "tm-es2", // Segunda
  "tm-it2", // Serie B
  "tm-fr2", // Ligue 2
  "tm-l2", // 2. Bundesliga
  // Americas / other recognizable top flights
  "mls",
  "serie-a-brazil",
  "tm-mexa",
  "tm-arg2",
  "tm-argc",
  // Familiar European sides (Shakhtar, Salzburg, Basel, Olympiacos, …)
  "tm-ukr1",
  "tm-ru1",
  "tm-dk1",
  "tm-se1",
  "tm-gr1",
  "tm-a1",
  "tm-c1",
]);

/** Min squad members that must also exist in the active draft pool. */
export const WHEEL_MIN_POOL_OVERLAP = 8;

let clubSeasonIndex: Map<string, ClubSeasonKey> | null = null;
/** Prebuilt from archive performances (team_name × season) — preferred source. */
let prebuiltRosters: ClubSeasonKey[] | null = null;
/** club id / lower name / slug → domestic league id */
let clubLeagueLookup: Map<string, string> | null = null;

function indexKey(clubName: string, seasonLabel: string): string {
  return `${clubName}::${seasonLabel}`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Parse season start year from `21/22`, `09/10`, `2009`, or `2009/10`. */
export function parseSeasonStartYear(seasonLabel: string): number | null {
  const s = String(seasonLabel).trim();
  if (!s) return null;

  const full = s.match(/^(\d{4})(?:\/\d{2,4})?$/);
  if (full) {
    const y = Number(full[1]);
    return Number.isFinite(y) ? y : null;
  }

  const short = s.match(/^(\d{2})\/(\d{2})$/);
  if (short) {
    const yy = Number(short[1]);
    if (!Number.isFinite(yy)) return null;
    // Football seasons: 50–99 → 1950–1999; 00–49 → 2000–2049.
    return yy >= 50 ? 1900 + yy : 2000 + yy;
  }

  const head = Number(s.replace(/\/.*/, ""));
  return Number.isFinite(head) ? head : null;
}

function seasonInModeRange(seasonLabel: string, mode: DraftModeConfig): boolean {
  const y = parseSeasonStartYear(seasonLabel);
  if (mode.era === "single_year" && mode.year) {
    return (
      seasonLabel === String(mode.year) ||
      String(seasonLabel).startsWith(String(mode.year)) ||
      y === mode.year
    );
  }
  if (mode.era === "decade" && mode.decade) {
    if (y == null) return false;
    const decade = mode.decade;
    if (decade === "1990s") return y >= 1990 && y < 2000;
    if (decade === "2000s") return y >= 2000 && y < 2010;
    if (decade === "2010s") return y >= 2010 && y < 2020;
    if (decade === "2020s") return y >= 2020;
  }
  if (mode.era === "custom_range" && mode.yearFrom != null && mode.yearTo != null) {
    return y != null && y >= mode.yearFrom && y <= mode.yearTo;
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

/** TM abbreviation aliases that are not fan-facing club brands (e.g. ZB Home). */
export function looksLikeJunkClubAlias(name: string): boolean {
  const s = name.trim();
  if (!s || s === "---") return true;
  if (/^(ZB|HB|AKA)\s/i.test(s)) return true;
  // Premier League 2 / U23 style labels if they leak in as club names
  if (/premier league 2/i.test(s)) return true;
  return false;
}

/** Build name/id → league lookup from clubs-extended. Call whenever clubs load. */
export function setWheelClubLookup(clubs: Club[]): void {
  const map = new Map<string, string>();
  for (const c of clubs) {
    if (!c.league) continue;
    map.set(c.id, c.league);
    map.set(c.name.toLowerCase(), c.league);
    map.set(slugify(c.name), c.league);
    // Common "FC X" / "X FC" variants
    const bare = c.name
      .replace(/\b(fc|cf|afc|sc|ac|as|ss|ud|cd|rc)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    if (bare && bare !== c.name.toLowerCase()) map.set(bare, c.league);
    if (bare) map.set(slugify(bare), c.league);
  }
  clubLeagueLookup = map;
}

export function resolveClubLeague(clubName: string, clubId?: string): string | null {
  if (!clubLeagueLookup) return null;
  if (clubId) {
    const byId = clubLeagueLookup.get(clubId);
    if (byId) return byId;
  }
  const lower = clubName.toLowerCase();
  if (clubLeagueLookup.has(lower)) return clubLeagueLookup.get(lower)!;
  const slug = slugify(clubName);
  if (clubLeagueLookup.has(slug)) return clubLeagueLookup.get(slug)!;
  const bare = clubName
    .replace(/\b(fc|cf|afc|sc|ac|as|ss|ud|cd|rc)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (bare && clubLeagueLookup.has(bare)) return clubLeagueLookup.get(bare)!;
  if (bare && clubLeagueLookup.has(slugify(bare))) return clubLeagueLookup.get(slugify(bare))!;
  return null;
}

export function isRecognizableWheelClub(clubName: string, clubId?: string): boolean {
  if (looksLikeCompetitionId(clubName) || looksLikeJunkClubAlias(clubName)) return false;
  const league = resolveClubLeague(clubName, clubId);
  return !!league && WHEEL_RECOGNIZED_LEAGUE_IDS.has(league);
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
  if (looksLikeCompetitionId(clubName) || looksLikeJunkClubAlias(clubName)) return null;
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
    mergePrebuiltInto(clubSeasonIndex);
  } else if (prebuiltRosters) {
    const index = new Map<string, ClubSeasonKey>();
    mergePrebuiltInto(index);
    clubSeasonIndex = index;
  }
}

function mergePrebuiltInto(index: Map<string, ClubSeasonKey>): void {
  if (!prebuiltRosters) return;
  for (const e of prebuiltRosters) {
    if (looksLikeCompetitionId(e.clubName) || looksLikeJunkClubAlias(e.clubName)) continue;
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
  setWheelClubLookup(clubsExtended);

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
    if (!isRecognizableWheelClub(entry.clubName, entry.clubId)) continue;
    if (mode.competitionScope === "single_league" && mode.leagueId) {
      const league = resolveClubLeague(entry.clubName, entry.clubId);
      if (league !== mode.leagueId) continue;
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
