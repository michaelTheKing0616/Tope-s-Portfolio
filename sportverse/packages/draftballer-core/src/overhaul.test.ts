import { describe, expect, it } from "vitest";
import { createRng, dailyChallengeSeed, hashSeed } from "./rng.js";
import { getFameScore } from "@sportverse/sports-db";

describe("rng", () => {
  it("same seed produces same sequence", () => {
    const a = createRng("test-seed-abc");
    const b = createRng("test-seed-abc");
    const seqA = [a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next()];
    expect(seqA).toEqual(seqB);
  });

  it("different seeds produce different sequences", () => {
    const a = createRng("seed-one");
    const b = createRng("seed-two");
    expect(a.next()).not.toBe(b.next());
  });

  it("daily challenge seed is stable for a date", () => {
    const d = new Date("2026-07-20T12:00:00Z");
    expect(dailyChallengeSeed(d)).toBe("daily-2026-07-20");
  });

  it("hashSeed is deterministic", () => {
    expect(hashSeed("messi")).toBe(hashSeed("messi"));
  });
});

describe("fame index", () => {
  it("messi has high fame", () => {
    expect(getFameScore("messi")).toBeGreaterThan(85);
  });

  it("unknown player returns 0", () => {
    expect(getFameScore("not-a-real-player-id-xyz")).toBe(0);
  });
});
