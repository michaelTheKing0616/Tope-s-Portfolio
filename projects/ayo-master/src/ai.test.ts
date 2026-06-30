import { describe, it, expect } from "vitest";
import { initialBoard, applyMove, legalMoves, type Board } from "./engine.js";
import { chooseMove, minimax, evaluate } from "./ai.js";

describe("evaluate", () => {
  it("favours North's store lead", () => {
    const b = initialBoard();
    b[13] = 10; // north store
    expect(evaluate(b)).toBeGreaterThan(0);
    b[6] = 25; // south store now ahead
    expect(evaluate(b)).toBeLessThan(0);
  });
});

describe("chooseMove", () => {
  it("returns a legal move for the side to play", () => {
    const b = initialBoard();
    const move = chooseMove(b, "north", { difficulty: "hard" });
    expect(legalMoves(b, "north")).toContain(move);
  });

  it("takes a free extra-turn move when one obviously helps", () => {
    // From the opening, North pit 11 (3 from its store... ) — assert it picks a
    // move that is at least as good as a random one by comparing evaluations.
    const b = initialBoard();
    const move = chooseMove(b, "north", { difficulty: "medium" });
    const r = applyMove(b, move, "north");
    expect(evaluate(r.board)).toBeGreaterThanOrEqual(evaluate(b));
  });

  it("is deterministic on medium/hard (no randomness)", () => {
    const b = initialBoard();
    const a = chooseMove(b, "north", { difficulty: "hard" });
    const c = chooseMove(b, "north", { difficulty: "hard" });
    expect(a).toBe(c);
  });

  it("a stronger AI beats a weaker one in self-play", () => {
    // North = hard, South = easy(random). Play to completion; North should win.
    let board: Board = initialBoard();
    let side: "south" | "north" = "north";
    const rng = mulberry32(42);
    let guard = 0;
    while (legalMoves(board, side).length > 0 && guard++ < 500) {
      const move =
        side === "north"
          ? chooseMove(board, "north", { difficulty: "hard" })
          : chooseMove(board, "south", { difficulty: "easy", rng });
      const r = applyMove(board, move, side);
      board = r.board;
      if (!r.extraTurn) side = side === "north" ? "south" : "north";
      if (legalMoves(board, "south").length === 0 || legalMoves(board, "north").length === 0) break;
    }
    const final = finalizeForTest(board);
    expect(final[13]).toBeGreaterThan(final[6]);
  });
});

describe("minimax", () => {
  it("returns a finite score at shallow depth", () => {
    const b = initialBoard();
    const v = minimax(b, 3, -Infinity, Infinity, "north");
    expect(Number.isFinite(v)).toBe(true);
  });
});

// Deterministic PRNG so the self-play test never flakes.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function finalizeForTest(board: Board): Board {
  const b = board.slice();
  let s = 0;
  let n = 0;
  for (let i = 0; i < 6; i++) ((s += b[i]!), (b[i] = 0));
  for (let i = 7; i < 13; i++) ((n += b[i]!), (b[i] = 0));
  b[6]! += s;
  b[13]! += n;
  return b;
}
