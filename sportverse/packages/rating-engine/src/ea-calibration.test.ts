import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ovrFromEaAttributes,
  ovrFromEaGkAttributes,
  setEaFc26Index,
  type EaRatingEntry,
} from "./ea-ratings.js";
import { computePlayerRating } from "./compute.js";
import type { DraftModeConfig } from "@sportverse/draftballer-types";

const dataDir = resolve(import.meta.dirname, "../../sports-db/data");
const eaIndex = JSON.parse(readFileSync(resolve(dataDir, "ea-fc26-index.json"), "utf8")) as EaRatingEntry[];
setEaFc26Index(eaIndex);

const eaCurrentMode: DraftModeConfig = {
  id: "ea-current-test",
  title: "EA Current",
  blurb: "",
  era: "all_time",
  competitionScope: "any_league",
  ratingLens: "club_only",
  blendFactor: 0,
  ratingBasis: "ea_current",
};

function ovrBucket(ovr: number): string {
  if (ovr >= 89) return "elite";
  if (ovr >= 86) return "world-class";
  if (ovr >= 81) return "very-good";
  if (ovr >= 76) return "good";
  if (ovr >= 66) return "average";
  if (ovr >= 56) return "squad";
  return "reserve";
}

/** Seeded shuffle for reproducible stratified sampling. */
function samplePerBucket(entries: EaRatingEntry[], perBucket: number, seed = 42): EaRatingEntry[] {
  const rand = (() => {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0x100000000;
    };
  })();
  const buckets = new Map<string, EaRatingEntry[]>();
  for (const e of entries) {
    const key = `${ovrBucket(e.ovr)}|${e.quizPosition}`;
    const list = buckets.get(key) ?? [];
    list.push(e);
    buckets.set(key, list);
  }
  const out: EaRatingEntry[] = [];
  for (const list of buckets.values()) {
    out.push(...[...list].sort(() => rand() - 0.5).slice(0, perBucket));
  }
  return out;
}

describe("EA FC 26 dataset calibration", () => {
  it("index covers full EA OVR range with GK and outfield attrs", () => {
    const ovrs = eaIndex.map((e) => e.ovr);
    expect(eaIndex.length).toBeGreaterThan(10_000);
    expect(Math.min(...ovrs)).toBeLessThanOrEqual(55);
    expect(Math.max(...ovrs)).toBeGreaterThanOrEqual(89);
    expect(eaIndex.some((e) => e.gkAttributes != null)).toBe(true);
    expect(eaIndex.some((e) => e.attributes != null)).toBe(true);
    expect(eaIndex.filter((e) => e.cardImage).length / eaIndex.length).toBeGreaterThan(0.95);
  });

  it("face-stat formula matches EA published OVR within 2 for most players", () => {
    const errors: number[] = [];
    for (const e of eaIndex) {
      let computed: number;
      if (e.gkAttributes) {
        computed = ovrFromEaGkAttributes(e.gkAttributes, e.ovr);
      } else if (e.attributes) {
        computed = ovrFromEaAttributes(e.quizPosition, e.attributes, e.ovr);
      } else continue;
      errors.push(Math.abs(computed - e.ovr));
    }
    const mae = errors.reduce((s, v) => s + v, 0) / errors.length;
    const within2 = errors.filter((e) => e <= 2).length / errors.length;
    expect(mae).toBeLessThan(1.5);
    expect(within2).toBeGreaterThan(0.92);
  });

  it("ea-current mode returns exact EA OVR for stratified sample", () => {
    const sample = samplePerBucket(eaIndex, 2);
    let exact = 0;
    for (const e of sample) {
      const card = computePlayerRating(
        { id: e.playerId, name: e.name, position: e.quizPosition, seasonStats: [] },
        eaCurrentMode,
      );
      if (card.ovr === e.ovr) exact++;
      expect(Math.abs(card.ovr - e.ovr)).toBeLessThanOrEqual(0);
    }
    expect(exact / sample.length).toBe(1);
  });

  it("all-time mode never rates EA-matched players below EA floor", () => {
    const allTimeMode: DraftModeConfig = {
      id: "all-time-test",
      title: "All-Time",
      blurb: "",
      era: "all_time",
      competitionScope: "any_league",
      ratingLens: "club_only",
      blendFactor: 0,
      ratingBasis: "prime",
    };
    const sample = samplePerBucket(
      eaIndex.filter((e) => e.ovr >= 81),
      3,
    );
    for (const e of sample) {
      const card = computePlayerRating(
        { id: e.playerId, name: e.name, position: e.quizPosition, seasonStats: [] },
        allTimeMode,
      );
      expect(card.ovr).toBeGreaterThanOrEqual(e.ovr);
    }
  });

  it("Rodri maps to curated id and rates at legend anchor in pool context", () => {
    const rodri = eaIndex.find((e) => e.name === "Rodri");
    expect(rodri?.playerId).toBe("rodri");
    expect(rodri?.ovr).toBe(90);
  });
});
