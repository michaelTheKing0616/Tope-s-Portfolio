import type { Club } from "./types.js";
import type {
  Competition,
  ConfederationStrengthIndexEntry,
  CrossLeagueFixture,
  EraBaseline,
  ExtendedPlayer,
  IconicMoment,
  LeagueStrengthIndexEntry,
  PlayerAlias,
  PlayerAward,
  PlayerSeasonStat,
  PlayerTransfer,
} from "./extended-types.js";
import { setLeagueStrengthData } from "./league-strength-data.js";
import { loadEngineCalibrationFromFetch } from "./engine-calibration.js";
import { resetProceduralQuizCache } from "./procedural-quiz.js";
import { seedLeagueResolver } from "./league-resolver.js";

let playersExtended: ExtendedPlayer[] | null = null;
let seasonStatsList: PlayerSeasonStat[] | null = null;
let competitionsList: Competition[] | null = null;
let clubsExtendedList: Club[] | null = null;
let eraBaselinesList: EraBaseline[] | null = null;
let playerAliasesList: PlayerAlias[] | null = null;
let awardsList: PlayerAward[] | null = null;
let iconicMomentsList: IconicMoment[] | null = null;
let statsByPlayer: Map<string, PlayerSeasonStat[]> | null = null;
let searchIndex: { player: ExtendedPlayer; tokens: string[] }[] | null = null;
let loadPromise: Promise<void> | null = null;

function rebuildStatsIndex() {
  statsByPlayer = new Map();
  for (const s of seasonStatsList ?? []) {
    const list = statsByPlayer.get(s.playerId) ?? [];
    list.push(s);
    statsByPlayer.set(s.playerId, list);
  }
}

interface ChunkManifest {
  source: string;
  chunkCount: number;
  totalItems: number;
}

function sportsDbCdnBase(): string | undefined {
  const cdn = (import.meta as ImportMeta & { env?: { VITE_SPORTS_DB_CDN?: string } }).env
    ?.VITE_SPORTS_DB_CDN?.trim();
  if (!cdn) return undefined;
  return cdn.endsWith("/") ? cdn : `${cdn}/`;
}

async function fetchGzJsonArray(url: string): Promise<unknown[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`);
  if (typeof DecompressionStream === "undefined") {
    throw new Error("gzip decompression is not supported in this browser");
  }
  const stream = res.body!.pipeThrough(new DecompressionStream("gzip"));
  const text = await new Response(stream).text();
  const data = JSON.parse(text) as unknown;
  if (!Array.isArray(data)) throw new Error(`${url} did not contain a JSON array`);
  return data;
}

async function fetchJsonArray(base: string, fileName: string): Promise<unknown[]> {
  const cdn = sportsDbCdnBase();
  if (cdn) {
    const gzUrl = `${cdn}${fileName}.gz`;
    try {
      const data = await fetchGzJsonArray(gzUrl);
      if (data.length) return data;
      throw new Error(`${gzUrl} returned an empty array`);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Failed to load ${fileName} from CDN (${gzUrl}): ${detail}. ` +
          `Run GitHub Actions "Build SPORTVERSE database" to publish ${fileName}.gz on release sports-db-latest.`,
      );
    }
  }

  const baseName = fileName.replace(/\.json$/i, "");
  const manifestUrl = `${base}data/chunks/${baseName}.manifest.json`;
  const manifestRes = await fetch(manifestUrl);

  if (manifestRes.ok) {
    const manifest = (await manifestRes.json()) as ChunkManifest;
    const parts = await Promise.all(
      Array.from({ length: manifest.chunkCount }, (_, i) => {
        const chunkPath = `${base}data/chunks/${baseName}/${String(i).padStart(3, "0")}.json`;
        return fetch(chunkPath).then((r) => {
          if (!r.ok) {
            throw new Error(`Failed to load ${baseName} chunk ${i} from ${chunkPath} (${r.status})`);
          }
          return r.json() as Promise<unknown[]>;
        });
      }),
    );
    return parts.flat();
  }

  const monolithUrl = `${base}data/${fileName}`;
  const res = await fetch(monolithUrl);
  if (!res.ok) {
    throw new Error(
      `Failed to load ${fileName}: manifest ${manifestUrl} (${manifestRes.status}), monolith ${monolithUrl} (${res.status})`,
    );
  }
  return res.json() as Promise<unknown[]>;
}

async function loadFromFetch(baseUrl: string) {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const [players, stats, competitions, clubs, eras, aliases, awards, moments, lsi, csi, fixtures, transfers] =
    await Promise.all([
    fetchJsonArray(base, "players-extended.json").then((data) => {
      if (!Array.isArray(data) || !data.length) {
        throw new Error("Failed to load players-extended.json (empty or invalid)");
      }
      return data;
    }),
    fetchJsonArray(base, "season-stats.json").then((data) => {
      if (!Array.isArray(data) || !data.length) {
        throw new Error("Failed to load season-stats.json (empty or invalid)");
      }
      return data;
    }),
    fetch(`${base}data/competitions.json`).then((r) => r.json()),
    fetch(`${base}data/clubs-extended.json`).then((r) => r.json()),
    fetch(`${base}data/era-baselines.json`).then((r) => r.json()),
    fetch(`${base}data/player-aliases.json`)
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []),
    fetch(`${base}data/awards.json`)
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []),
    fetch(`${base}data/iconic_moments.json`)
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []),
    fetch(`${base}data/league-strength-index.json`)
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []),
    fetch(`${base}data/confederation-strength-index.json`)
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []),
    fetch(`${base}data/cross-league-fixtures.json`)
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []),
    fetch(`${base}data/player-transfers.json`)
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []),
  ]);
  playersExtended = players as ExtendedPlayer[];
  seasonStatsList = stats as PlayerSeasonStat[];
  competitionsList = competitions as Competition[];
  clubsExtendedList = clubs as Club[];
  eraBaselinesList = eras as EraBaseline[];
  playerAliasesList = aliases as PlayerAlias[];
  awardsList = awards as PlayerAward[];
  iconicMomentsList = moments as IconicMoment[];
  rebuildStatsIndex();
  seedLeagueResolver(clubsExtendedList!, competitionsList!);
  setLeagueStrengthData({
    leagueStrengthIndex: lsi as LeagueStrengthIndexEntry[],
    confederationStrengthIndex: csi as ConfederationStrengthIndexEntry[],
    crossLeagueFixtures: fixtures as CrossLeagueFixture[],
    playerTransfers: transfers as PlayerTransfer[],
  });
  await loadEngineCalibrationFromFetch(base);
}

/** Load extended datasets once via fetch (browser + Node API). */
export async function ensureExtendedDataLoaded(baseUrl?: string): Promise<void> {
  if (playersExtended) return;
  if (loadPromise) return loadPromise;

  const base =
    baseUrl ??
    (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env?.BASE_URL ??
    "/";

  loadPromise = loadFromFetch(base);
  return loadPromise;
}

function assertLoaded() {
  if (!playersExtended || !statsByPlayer) {
    throw new Error("[sports-db] Extended data not loaded — call ensureExtendedDataLoaded() first");
  }
}

export function isExtendedDataLoaded(): boolean {
  return playersExtended !== null;
}

export function getExtendedPlayers(): ExtendedPlayer[] {
  assertLoaded();
  return playersExtended!;
}

export function getExtendedPlayer(id: string): ExtendedPlayer | undefined {
  assertLoaded();
  return playersExtended!.find((p) => p.id === id);
}

export function getSeasonStats(playerId: string): PlayerSeasonStat[] {
  assertLoaded();
  return statsByPlayer!.get(playerId) ?? [];
}

export function getCompetitions(): Competition[] {
  assertLoaded();
  return competitionsList ?? [];
}

export function getClubsExtended(): Club[] {
  assertLoaded();
  return clubsExtendedList ?? [];
}

export function getEraBaselines(): EraBaseline[] {
  assertLoaded();
  return eraBaselinesList ?? [];
}

export function getPlayerAliases(): PlayerAlias[] {
  assertLoaded();
  return playerAliasesList ?? [];
}

export function getAwards(): PlayerAward[] {
  assertLoaded();
  return awardsList ?? [];
}

export function getIconicMoments(): IconicMoment[] {
  assertLoaded();
  return iconicMomentsList ?? [];
}

function buildSearchIndex(): { player: ExtendedPlayer; tokens: string[] }[] {
  if (searchIndex) return searchIndex;
  assertLoaded();
  searchIndex = playersExtended!.map((p) => {
    const tokens = [
      p.name,
      p.nationality ?? "",
      ...(p.clubs ?? []),
      ...(p.decades ?? []),
      p.position ?? "",
    ]
      .join(" ")
      .toLowerCase()
      .split(/[\s,./-]+/)
      .filter(Boolean);
    return { player: p, tokens: [...new Set(tokens)] };
  });
  return searchIndex;
}

function scoreMatch(tokens: string[], qTokens: string[]): number {
  let score = 0;
  for (const qt of qTokens) {
    for (const t of tokens) {
      if (t === qt) score += 10;
      else if (t.startsWith(qt)) score += 6;
      else if (t.includes(qt)) score += 3;
    }
  }
  return score;
}

/** Token-indexed fuzzy search — Meilisearch-compatible API surface (§Phase 11 upgrade). */
export function searchPlayers(query: string, limit = 30): ExtendedPlayer[] {
  assertLoaded();
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const qTokens = q.split(/[\s,./-]+/).filter(Boolean);
  if (!qTokens.length) return [];

  return buildSearchIndex()
    .map(({ player, tokens }) => ({ player, score: scoreMatch(tokens, qTokens) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.player);
}

export function extendedPoolCounts() {
  assertLoaded();
  return {
    playersExtended: playersExtended!.length,
    seasonStatRows: seasonStatsList!.length,
    competitions: competitionsList!.length,
    clubsExtended: clubsExtendedList!.length,
    eraBaselines: eraBaselinesList!.length,
  };
}

/** Test / Node bootstrap: inject bundled JSON without fetch. */
export function __setExtendedDataForTests(data: {
  players: ExtendedPlayer[];
  stats: PlayerSeasonStat[];
  competitions?: Competition[];
  clubs?: Club[];
  eras?: EraBaseline[];
  aliases?: PlayerAlias[];
  awards?: PlayerAward[];
  moments?: IconicMoment[];
  leagueStrengthIndex?: LeagueStrengthIndexEntry[];
  confederationStrengthIndex?: ConfederationStrengthIndexEntry[];
  crossLeagueFixtures?: CrossLeagueFixture[];
  playerTransfers?: PlayerTransfer[];
}) {
  playersExtended = data.players;
  seasonStatsList = data.stats;
  searchIndex = null;
  competitionsList = data.competitions ?? [];
  clubsExtendedList = data.clubs ?? [];
  eraBaselinesList = data.eras ?? [];
  playerAliasesList = data.aliases ?? [];
  awardsList = data.awards ?? [];
  iconicMomentsList = data.moments ?? [];
  rebuildStatsIndex();
  seedLeagueResolver(clubsExtendedList, competitionsList);
  setLeagueStrengthData({
    leagueStrengthIndex: data.leagueStrengthIndex,
    confederationStrengthIndex: data.confederationStrengthIndex,
    crossLeagueFixtures: data.crossLeagueFixtures,
    playerTransfers: data.playerTransfers,
  });
  resetProceduralQuizCache();
  loadPromise = Promise.resolve();
}
