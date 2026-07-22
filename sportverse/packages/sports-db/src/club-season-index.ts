import type { DraftModeConfig } from "@sportverse/draftballer-types";
import type { PlayerSeasonStat } from "./extended-types.js";
import type { Club } from "./types.js";
import { getCompetitions } from "./extended.js";
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
  // Big 5 + known second tiers fans actually know
  "premier-league",
  "la-liga",
  "serie-a",
  "bundesliga",
  "ligue-1",
  "championship",
  "tm-es2", // Segunda
  "tm-it2", // Serie B
  "tm-fr2", // Ligue 2
  "tm-l2", // 2. Bundesliga
  // Other top flights with household clubs
  "eredivisie",
  "primeira-liga",
  "super-lig",
  "scottish-premiership",
  "pro-league",
  "mls",
  "serie-a-brazil",
  "tm-mexa",
  "tm-argc", // Argentine first division brands (River, Boca, …)
  "tm-ukr1",
  "tm-a1", // Austria (Salzburg, …)
]);

/** Min squad members that must also exist in the active draft pool. */
export const WHEEL_MIN_POOL_OVERLAP = 12;

/** Drop obscure club-seasons even if league is recognized. */
export const WHEEL_MIN_FAME_SUM = 900;

/** Min clubs in a league×season for season-sim historical challengers. */
export const SIM_MIN_CLUBS = 10;

/** Min squad size for a club-season to enter sim challenger pools. */
export const SIM_MIN_SQUAD_PLAYERS = 11;

export interface SimChallengerCatalogEntry {
  leagueId: string;
  leagueName: string;
  seasonLabel: string;
  clubCount: number;
  ready: boolean;
}

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
    if (entry.fameSum < WHEEL_MIN_FAME_SUM) continue;
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

function leagueDisplayName(leagueId: string): string {
  const hit = getCompetitions().find((c) => c.id === leagueId);
  return hit?.name ?? leagueId;
}

function isSimEligibleClubSeason(entry: ClubSeasonKey): boolean {
  if (looksLikeCompetitionId(entry.clubName) || looksLikeJunkClubAlias(entry.clubName)) return false;
  return entry.playerIds.length >= SIM_MIN_SQUAD_PLAYERS;
}

/** All club-season rows usable for sim challengers (no wheel fame gate). */
function simEligibleClubSeasons(): ClubSeasonKey[] {
  const seen = new Set<string>();
  const out: ClubSeasonKey[] = [];

  const consider = (entry: ClubSeasonKey) => {
    if (!isSimEligibleClubSeason(entry)) return;
    const key = indexKey(entry.clubName, entry.seasonLabel);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(entry);
  };

  if (clubSeasonIndex) {
    for (const entry of clubSeasonIndex.values()) consider(entry);
  }
  if (prebuiltRosters) {
    for (const entry of prebuiltRosters) consider(entry);
  }
  return out;
}

/** Enumerate league×season combos from archive data — no hard-coded league list. */
export function listSimChallengers(): SimChallengerCatalogEntry[] {
  const grouped = new Map<string, { leagueId: string; seasonLabel: string; clubCount: number }>();

  for (const entry of simEligibleClubSeasons()) {
    const leagueId = resolveClubLeague(entry.clubName, entry.clubId);
    if (!leagueId) continue;
    const key = `${leagueId}::${entry.seasonLabel}`;
    const prev = grouped.get(key);
    if (prev) {
      prev.clubCount += 1;
    } else {
      grouped.set(key, { leagueId, seasonLabel: entry.seasonLabel, clubCount: 1 });
    }
  }

  return [...grouped.values()]
    .map(({ leagueId, seasonLabel, clubCount }) => ({
      leagueId,
      leagueName: leagueDisplayName(leagueId),
      seasonLabel,
      clubCount,
      ready: clubCount >= SIM_MIN_CLUBS,
    }))
    .sort((a, b) => {
      if (a.ready !== b.ready) return a.ready ? -1 : 1;
      if (b.clubCount !== a.clubCount) return b.clubCount - a.clubCount;
      const ya = parseSeasonStartYear(a.seasonLabel) ?? 0;
      const yb = parseSeasonStartYear(b.seasonLabel) ?? 0;
      if (yb !== ya) return yb - ya;
      return a.leagueName.localeCompare(b.leagueName);
    });
}

/** Club-season squads for sim opponents — ≥11 players, no wheel fame filter. */
export function listSimClubSeasons(leagueId: string, seasonLabel: string): ClubSeasonKey[] {
  return simEligibleClubSeasons()
    .filter((entry) => {
      if (entry.seasonLabel !== seasonLabel) return false;
      const league = resolveClubLeague(entry.clubName, entry.clubId);
      return league === leagueId;
    })
    .sort((a, b) => b.playerIds.length - a.playerIds.length);
}
