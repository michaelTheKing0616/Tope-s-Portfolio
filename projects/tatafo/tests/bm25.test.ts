import { describe, expect, it } from "vitest";
import { bm25Score } from "../src/search.js";
import { buildIndex } from "../src/indexer.js";

describe("bm25", () => {
  const index = buildIndex([
    {
      path: "a.md",
      mtimeMs: 1,
      chunks: [{ id: "c1", filePath: "a.md", startLine: 1, endLine: 1, text: "alpha beta gamma" }],
    },
    {
      path: "b.md",
      mtimeMs: 1,
      chunks: [{ id: "c2", filePath: "b.md", startLine: 1, endLine: 1, text: "delta epsilon" }],
    },
  ]);

  it("scores matching terms higher", () => {
    const tf = { alpha: 1, beta: 1 };
    const s = bm25Score(["alpha", "beta"], tf, 2, index);
    expect(s).toBeGreaterThan(0);
    const miss = bm25Score(["zzz"], {}, 0, index);
    expect(miss).toBe(0);
  });

  it("builds v2 index with avgDocLength", () => {
    expect(index.version).toBe(2);
    expect(index.avgDocLength).toBeGreaterThan(0);
  });
});
