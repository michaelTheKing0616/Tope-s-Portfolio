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

export type { CareerPathEntry, Club, Player, SpeedQuestion, TrueFalseStatement };

const validationErrors = validateCuratedBank();
if (validationErrors.length > 0) {
  console.error("[sports-db] Curated quiz bank validation failed:\n", validationErrors.join("\n"));
  if (process.env.NODE_ENV === "test") {
    throw new Error(`Curated bank invalid: ${validationErrors[0]}`);
  }
}

const counts = curatedPoolCounts();

/** Verified real players only — no procedural name generation. */
export function getPlayers(): Player[] {
  return getCuratedPlayers();
}

export function getPlayer(id: string): Player | undefined {
  return getPlayers().find((p) => p.id === id);
}

export function getClubs(): Club[] {
  return getCuratedClubs();
}

export function getClub(id: string): Club | undefined {
  return getClubs().find((c) => c.id === id);
}

export function getTrueFalse(): TrueFalseStatement[] {
  return getCuratedTrueFalse();
}

export function getSpeedQuestions(): SpeedQuestion[] {
  return getCuratedSpeedQuestions();
}

export function getCareerPaths(): CareerPathEntry[] {
  return getCuratedCareerPaths();
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

/** Size of the verified player pool (quiz modes cycle through curated data). */
export function poolCount(): number {
  return counts.players;
}

export function poolCounts() {
  return { ...counts, footballIQ: SIM_POOL_SIZE, goalkeeper: SIM_POOL_SIZE };
}

let simPools: ReturnType<typeof getSimPools> | null = null;

function simPoolsReady() {
  if (!simPools) simPools = getSimPools(SIM_POOL_SIZE);
  return simPools;
}

/** Tactical scenarios — procedural game mechanics, not factual trivia. */
export function getFootballIQPool() {
  return simPoolsReady().footballIQ;
}

export function getFootballIQScenario(index: number) {
  const pool = getFootballIQPool();
  return pool[index % pool.length]!;
}

/** Reaction game levels — procedural, not factual trivia. */
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
