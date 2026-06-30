import type { ContentPools } from "./generators.js";
import {
  generateFootballIQPool,
  generateGoalkeeperPool,
  POOL_SIZE,
} from "./generators.js";

export { POOL_SIZE, generateFootballIQScenario, generateGoalkeeperLevel } from "./generators.js";
export type { ContentPools } from "./generators.js";
export { mulberry32, hashString } from "./rng.js";

let simCached: Pick<ContentPools, "footballIQ" | "goalkeeper"> | null = null;

/** Procedural pools for skill games only (not factual quiz content). */
export function getSimPools(size = POOL_SIZE): Pick<ContentPools, "footballIQ" | "goalkeeper"> {
  if (simCached && simCached.footballIQ.length >= size) return simCached;
  simCached = {
    footballIQ: generateFootballIQPool(size),
    goalkeeper: generateGoalkeeperPool(size),
  };
  return simCached;
}

/** @deprecated Use getSimPools — quiz data lives in sports-db curated JSON. */
export function getContentPools(size = POOL_SIZE): ContentPools {
  const sim = getSimPools(size);
  return {
    players: [],
    clubs: [],
    trueFalse: [],
    speedQuestions: [],
    careerPaths: [],
    footballIQ: sim.footballIQ,
    goalkeeper: sim.goalkeeper,
  };
}

export function poolSize(): number {
  return POOL_SIZE;
}
