import { describe, expect, it } from "vitest";
import {
  getPlayers,
  getTrueFalse,
  getCareerPaths,
  poolCount,
  validateCuratedBank,
  curatedPoolCounts,
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

  it("uses only real verified players (no procedural combos)", () => {
    const players = getPlayers();
    expect(players.length).toBeGreaterThanOrEqual(60);
    const names = new Set(players.map((p) => p.name));
    expect(names.size).toBe(players.length);
    expect(players.some((p) => p.name === "Gerard Mbappe")).toBe(false);
    expect(players.some((p) => p.name === "Kylian Mbappé")).toBe(true);
  });

  it("career paths match player club histories", () => {
    const errors = validateCuratedBank();
    expect(errors.filter((e) => e.includes("Career path"))).toEqual([]);
    expect(getCareerPaths().length).toBeGreaterThanOrEqual(40);
  });
});

describe("quiz-engine", () => {
  it("exposes verified content pool size", () => {
    expect(contentPoolSize()).toBe(poolCount());
    expect(contentPoolSize()).toBeGreaterThanOrEqual(60);
    expect(curatedPoolCounts().trueFalse).toBeGreaterThanOrEqual(20);
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
    const stmt = getTrueFalse().find((t) => t.id === "tf7")!;
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
