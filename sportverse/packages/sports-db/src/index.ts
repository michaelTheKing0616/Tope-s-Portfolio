import { getSimPools, POOL_SIZE as SIM_POOL_SIZE } from "@sportverse/content-gen";
import type { CareerPathEntry, Club, Player, SpeedQuestion, TrueFalseStatement } from "./types.js";
import {
  curatedPoolCounts,
  getCuratedCareerPaths,
  getCuratedClubs,
  getCuratedPlayers,
  getCuratedSpeedQuestions,
  getCuratedTrueFalse,
  validateCuratedBank,
} from "./curated.js";
import {
  getProceduralCareerPaths,
  getProceduralQuizClubs,
  getProceduralQuizPlayer,
  getProceduralQuizPlayers,
  getProceduralSpeedQuestions,
  getProceduralTrueFalse,
  proceduralQuizCounts,
  resetProceduralQuizCache,
} from "./procedural-quiz.js";
import {
  extendedPoolCounts,
  ensureExtendedDataLoaded,
  getClubsExtended,
  getCompetitions,
  getExtendedPlayer,
  getExtendedPlayers,
  getEraBaselines,
  getSeasonStats,
  getPlayerAliases,
  getAwards,
  getIconicMoments,
  isExtendedDataLoaded,
  searchPlayers,
  __setExtendedDataForTests,
} from "./extended.js";
import {
  getAllConfederationStrengthIndex,
  getAllLeagueStrengthIndex,
  getConfederationStrengthIndex,
  getCrossLeagueFixtures,
  getLeagueStrengthIndex,
  getPlayerTransfers,
  lsiConfidenceLabel,
  setLeagueStrengthData,
} from "./league-strength-data.js";
import { resolveCompetitionToLeague, seedLeagueResolver } from "./league-resolver.js";
import {
  getFameScore,
  getFameEntry,
  getFameIndex,
  fameTierFromScore,
  setFameIndex,
  type FameEntry,
  type FameTier,
} from "./fame.js";
import {
  listSpinnableClubSeasons,
  getClubSeasonSquad,
  getClubSeasonEntry,
  listSimChallengers,
  listSimClubSeasons,
  looksLikeCompetitionId,
  looksLikeJunkClubAlias,
  isRecognizableWheelClub,
  parseSeasonStartYear,
  setPrebuiltClubSeasons,
  setWheelClubLookup,
  WHEEL_RECOGNIZED_LEAGUE_IDS,
  WHEEL_MIN_POOL_OVERLAP,
  WHEEL_MIN_FAME_SUM,
  SIM_MIN_CLUBS,
  SIM_MIN_SQUAD_PLAYERS,
  type ClubSeasonKey,
  type SimChallengerCatalogEntry,
} from "./club-season-index.js";

export type { CareerPathEntry, Club, Player, SpeedQuestion, TrueFalseStatement };
export type {
  PlayerSeasonStat,
  Competition,
  EraBaseline,
  ExtendedPlayer,
  PlayerAlias,
  PlayerAward,
  IconicMoment,
  LeagueStrengthIndexEntry,
  CrossLeagueFixture,
  PlayerTransfer,
  ConfederationStrengthIndexEntry,
} from "./extended-types.js";
export {
  getEngineCalibration,
  setEngineCalibration,
  loadEngineCalibrationFromFetch,
  EXPERT_PRIOR_CALIBRATION,
  type EngineCalibrationPayload,
} from "./engine-calibration.js";
export {
  getSeasonStats,
  getCompetitions,
  getClubsExtended,
  getEraBaselines,
  getPlayerAliases,
  getAwards,
  getIconicMoments,
  searchPlayers,
  getExtendedPlayers,
  getExtendedPlayer,
  ensureExtendedDataLoaded,
  isExtendedDataLoaded,
  __setExtendedDataForTests,
  getLeagueStrengthIndex,
  getConfederationStrengthIndex,
  getCrossLeagueFixtures,
  getPlayerTransfers,
  getAllLeagueStrengthIndex,
  getAllConfederationStrengthIndex,
  setLeagueStrengthData,
  lsiConfidenceLabel,
  resolveCompetitionToLeague,
  seedLeagueResolver,
  getFameScore,
  getFameEntry,
  getFameIndex,
  fameTierFromScore,
  setFameIndex,
  listSpinnableClubSeasons,
  getClubSeasonSquad,
  getClubSeasonEntry,
  listSimChallengers,
  listSimClubSeasons,
  looksLikeCompetitionId,
  looksLikeJunkClubAlias,
  isRecognizableWheelClub,
  parseSeasonStartYear,
  setPrebuiltClubSeasons,
  setWheelClubLookup,
  WHEEL_RECOGNIZED_LEAGUE_IDS,
  WHEEL_MIN_POOL_OVERLAP,
  WHEEL_MIN_FAME_SUM,
  SIM_MIN_CLUBS,
  SIM_MIN_SQUAD_PLAYERS,
};
export type { FameEntry, FameTier, ClubSeasonKey, SimChallengerCatalogEntry };
export type { ExtendedLoadProgress, ExtendedLoadProgressFn } from "./extended.js";
export {
  competitionDisplayName,
  clubDisplayName,
  seasonContextLabel,
} from "./display-names.js";

const validationErrors = validateCuratedBank();
if (validationErrors.length > 0) {
  console.error("[sports-db] Curated quiz bank validation failed:\n", validationErrors.join("\n"));
  if (process.env.NODE_ENV === "test") {
    throw new Error(`Curated bank invalid: ${validationErrors[0]}`);
  }
}

const curatedCounts = curatedPoolCounts();
const extCounts = isExtendedDataLoaded() ? extendedPoolCounts() : { playersExtended: 0, seasonStatRows: 0, competitions: 0, clubsExtended: 0, eraBaselines: 0 };

/** Quiz modes: full extended database with procedurally generated clues (infinite play). */
export function getPlayers(): Player[] {
  if (!isExtendedDataLoaded()) return getCuratedPlayers();
  return getProceduralQuizPlayers();
}

/** DRAFTBALLER / draft pool: full ETL player set. */
export function getDraftPlayers() {
  return getExtendedPlayers();
}

export function getPlayer(id: string): Player | undefined {
  if (isExtendedDataLoaded()) {
    // Prefer the procedural quiz card (rich clue ladder). Raw extended rows
    // usually only store 2 ETL boilerplate clues — using those for Who Am I
    // capped "Next clue" at 2 even when the deck had more.
    return (
      getProceduralQuizPlayer(id) ??
      getExtendedPlayer(id) ??
      getCuratedPlayers().find((p) => p.id === id)
    );
  }
  return getCuratedPlayers().find((p) => p.id === id);
}

export function getClubs(): Club[] {
  const byId = new Map<string, Club>();
  if (isExtendedDataLoaded()) {
    for (const c of getProceduralQuizClubs()) byId.set(c.id, c);
  }
  for (const c of getCuratedClubs()) byId.set(c.id, c);
  return [...byId.values()];
}

export function getClub(id: string): Club | undefined {
  return getClubs().find((c) => c.id === id);
}

export function getTrueFalse(): TrueFalseStatement[] {
  if (!isExtendedDataLoaded()) return getCuratedTrueFalse();
  return getProceduralTrueFalse();
}

export function getSpeedQuestions(): SpeedQuestion[] {
  if (!isExtendedDataLoaded()) return getCuratedSpeedQuestions();
  return getProceduralSpeedQuestions();
}

export function getCareerPaths(): CareerPathEntry[] {
  if (!isExtendedDataLoaded()) return getCuratedCareerPaths();
  return getProceduralCareerPaths();
}

export function getPlayerByIndex(index: number): Player {
  const list = getPlayers();
  return list[index % list.length]!;
}

export function getClubByIndex(index: number): Club {
  const list = getClubs();
  return list[index % list.length]!;
}

export function getTrueFalseByIndex(index: number): TrueFalseStatement {
  const list = getTrueFalse();
  return list[index % list.length]!;
}

export function getSpeedQuestionByIndex(index: number): SpeedQuestion {
  const list = getSpeedQuestions();
  return list[index % list.length]!;
}

export function getCareerPathByIndex(index: number): CareerPathEntry {
  const list = getCareerPaths();
  return list[index % list.length]!;
}

export function poolCount(): number {
  return getPlayers().length;
}

export function poolCounts() {
  const proc = isExtendedDataLoaded() ? proceduralQuizCounts() : curatedPoolCounts();
  return {
    ...curatedCounts,
    ...extCounts,
    ...proc,
    players: getPlayers().length,
    draftPlayers: extCounts.playersExtended,
    footballIQ: SIM_POOL_SIZE,
    goalkeeper: SIM_POOL_SIZE,
  };
}

let simPools: ReturnType<typeof getSimPools> | null = null;

function simPoolsReady() {
  if (!simPools) simPools = getSimPools(SIM_POOL_SIZE);
  return simPools;
}

export function getFootballIQPool() {
  return simPoolsReady().footballIQ;
}

export function getFootballIQScenario(index: number) {
  const pool = getFootballIQPool();
  return pool[index % pool.length]!;
}

export function getGoalkeeperPool() {
  return simPoolsReady().goalkeeper;
}

export function getGoalkeeperLevel(levelId: number) {
  const pool = getGoalkeeperPool();
  return pool.find((l) => l.id === levelId) ?? pool[(levelId - 1) % pool.length]!;
}

export function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export { validateCuratedBank, curatedPoolCounts };
