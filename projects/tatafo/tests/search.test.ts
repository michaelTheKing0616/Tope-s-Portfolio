import { describe, expect, it } from "vitest";
import { chunkText, tokenize } from "../src/chunker.js";
import { buildIndex } from "../src/indexer.js";
import { ask, search } from "../src/search.js";

describe("chunker", () => {
  it("tokenizes and chunks deterministically", () => {
    const text = "alpha beta gamma\n".repeat(40);
    const chunks = chunkText(text, "notes.md");
    expect(chunks.length).toBeGreaterThan(1);
    expect(tokenize("Hello, Lagos!")).toContain("hello");
  });
});

describe("search", () => {
  const index = buildIndex([
    {
      path: "a.md",
      mtimeMs: 1,
      chunks: [
        {
          id: "c1",
          filePath: "a.md",
          startLine: 1,
          endLine: 3,
          text: "LingAfriq teaches Yoruba with spaced repetition and an AI tutor.",
        },
      ],
    },
    {
      path: "b.md",
      mtimeMs: 1,
      chunks: [
        {
          id: "c2",
          filePath: "b.md",
          startLine: 1,
          endLine: 2,
          text: "Paystack webhooks must be idempotent with a dedupe table.",
        },
      ],
    },
  ]);

  it("ranks relevant chunks higher", () => {
    const hits = search(index, "Yoruba language tutor");
    expect(hits[0]?.chunk.filePath).toBe("a.md");
  });

  it("formats grounded answers with citations", () => {
    const result = ask(index, "idempotent webhook");
    expect(result.answer).toContain("b.md");
    expect(result.answer).toContain("nothing left your machine");
  });
});
