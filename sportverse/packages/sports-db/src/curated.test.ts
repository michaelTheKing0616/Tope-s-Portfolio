import { describe, expect, it } from "vitest";
import {
  getPlayers,
  getTrueFalse,
  getCareerPaths,
  getSpeedQuestions,
  poolCount,
  poolCounts,
  validateCuratedBank,
} from "../src/index.js";
import {
  answerWhoAmI,
  answerTrueFalse,
  startWhoAmI,
  submitCareerPath,
  startCareerPath,
  createWhoAmIDeck,
  contentPoolSize,
} from "@sportverse/quiz-engine";

describe("curated sports-db", () => {
  it("passes validation with no errors", () => {
    expect(validateCuratedBank()).toEqual([]);
  });

  it("draws from the full extended player archive", () => {
    const players = getPlayers();
    expect(players.length).toBeGreaterThan(100);
    const ids = new Set(players.map((p) => p.id));
    expect(ids.size).toBe(players.length);
    expect(players.every((p) => p.clues.length >= 3)).toBe(true);
    expect(players.some((p) => p.name === "Kylian Mbappé" || p.name.includes("Mbapp"))).toBe(true);
  });

  it("career paths match player club histories", () => {
    const errors = validateCuratedBank();
    expect(errors.filter((e) => e.includes("Career path"))).toEqual([]);
    const minPaths = (poolCounts().seasonStatRows ?? 0) > 1000 ? 40 : 2;
    expect(getCareerPaths().length).toBeGreaterThanOrEqual(minPaths);
  });
});

describe("quiz-engine", () => {
  it("exposes full-database content pool size", () => {
    const fullData = (poolCounts().seasonStatRows ?? 0) > 1000;
    expect(contentPoolSize()).toBe(poolCount());
    expect(contentPoolSize()).toBeGreaterThan(100);
    if (fullData) {
      expect(getTrueFalse().length).toBeGreaterThan(100);
      expect(getSpeedQuestions().length).toBeGreaterThan(100);
      expect(getCareerPaths().length).toBeGreaterThan(40);
    } else {
      expect(getTrueFalse().length).toBeGreaterThan(10);
      expect(getSpeedQuestions().length).toBeGreaterThan(10);
      expect(getCareerPaths().length).toBeGreaterThanOrEqual(2);
    }
  });

  it("scores Who Am I by clue index", () => {
    const player = getPlayers().find((p) => p.id === "mbappe")!;
    const state = startWhoAmI(player.id);
    const result = answerWhoAmI(state, "Kylian Mbappé");
    expect(result.correct).toBe(true);
    expect(result.score).toBe(1000);
  });

  it("accepts surname-only Who Am I answers", () => {
    const player = getPlayers().find((p) => p.id === "mbappe")!;
    const state = startWhoAmI(player.id);
    const result = answerWhoAmI(state, "Mbappe");
    expect(result.correct).toBe(true);
  });

  it("grades true/false with explanation", () => {
    const stmt = getTrueFalse().find((t) => t.id === "tf7") ?? getTrueFalse()[0]!;
    const result = answerTrueFalse(stmt.id, stmt.answer);
    expect(result.correct).toBe(true);
    expect(result.details).toBeTruthy();
  });

  it("scores career path order", () => {
    const entry = getCareerPaths().find((c) => c.playerId === "messi")!;
    const { pathId, shuffled } = startCareerPath(entry.id);
    const result = submitCareerPath({ pathId, playerOrder: [], submitted: false, correct: false }, entry.clubs);
    expect(result.correct).toBe(true);
    expect(shuffled.length).toBe(entry.clubs.length);
  });

  it("session deck cycles without immediate repeats", () => {
    const deck = createWhoAmIDeck();
    const first = deck.next();
    const second = deck.next();
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(first!.id).not.toBe(second!.id);
  });
});
