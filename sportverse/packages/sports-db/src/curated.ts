/**
 * Verified quiz bank — every entry is a real player/club/fact.
 * Quiz modes MUST use this module only (no procedural name generation).
 */
import type { CareerPathEntry, Club, Player, SpeedQuestion, TrueFalseStatement } from "./types.js";
import playersData from "../data/players.json" with { type: "json" };
import clubsData from "../data/clubs.json" with { type: "json" };
import trueFalseData from "../data/true-false.json" with { type: "json" };
import speedData from "../data/speed-questions.json" with { type: "json" };

const players = playersData as Player[];
const clubs = clubsData as Club[];
const trueFalse = trueFalseData as TrueFalseStatement[];
const speedQuestions = speedData as SpeedQuestion[];

/** Career paths derived from verified club histories (3+ senior clubs). */
const careerPaths: CareerPathEntry[] = players
  .filter((p) => (p.clubs?.length ?? 0) >= 3)
  .map((p) => ({
    id: `cp-${p.id}`,
    playerId: p.id,
    clubs: [...p.clubs!],
  }));

export function getCuratedPlayers(): Player[] {
  return players;
}

export function getCuratedClubs(): Club[] {
  return clubs;
}

export function getCuratedTrueFalse(): TrueFalseStatement[] {
  return trueFalse;
}

export function getCuratedSpeedQuestions(): SpeedQuestion[] {
  return speedQuestions;
}

export function getCuratedCareerPaths(): CareerPathEntry[] {
  return careerPaths;
}

export function curatedPoolCounts() {
  return {
    players: players.length,
    clubs: clubs.length,
    trueFalse: trueFalse.length,
    speedQuestions: speedQuestions.length,
    careerPaths: careerPaths.length,
  };
}

/** Fail fast in dev/test if curated data is malformed. */
export function validateCuratedBank(): string[] {
  const errors: string[] = [];
  const playerIds = new Set(players.map((p) => p.id));

  for (const p of players) {
    if (!p.name?.trim()) errors.push(`Player ${p.id}: missing name`);
    if (p.clues.length < 3) errors.push(`Player ${p.name}: needs at least 3 clues`);
  }

  for (const c of clubs) {
    if (!c.name?.trim()) errors.push(`Club ${c.id}: missing name`);
    if (c.clues.length < 3) errors.push(`Club ${c.name}: needs at least 3 clues`);
  }

  for (const q of speedQuestions) {
    if (q.answerIndex < 0 || q.answerIndex >= q.options.length) {
      errors.push(`Speed Q ${q.id}: answerIndex out of range`);
    }
  }

  for (const cp of careerPaths) {
    if (!playerIds.has(cp.playerId)) {
      errors.push(`Career path ${cp.id}: unknown playerId ${cp.playerId}`);
    }
    const player = players.find((p) => p.id === cp.playerId);
    if (player?.clubs && JSON.stringify(player.clubs) !== JSON.stringify(cp.clubs)) {
      errors.push(`Career path ${cp.id}: clubs mismatch for ${player.name}`);
    }
  }

  return errors;
}
