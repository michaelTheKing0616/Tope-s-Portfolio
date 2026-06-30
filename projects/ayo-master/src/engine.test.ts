import { describe, it, expect } from "vitest";
import {
  initialBoard,
  legalMoves,
  applyMove,
  isGameOver,
  finalize,
  winner,
  PITS,
  STORE,
} from "./engine.js";

describe("initialBoard", () => {
  it("seeds 4 per pit and empty stores, summing to 48", () => {
    const b = initialBoard();
    expect(b[STORE.south]).toBe(0);
    expect(b[STORE.north]).toBe(0);
    expect(PITS.south.every((p) => b[p] === 4)).toBe(true);
    expect(b.reduce((a, c) => a + c, 0)).toBe(48);
  });
});

describe("applyMove — sowing", () => {
  it("does not mutate the input board", () => {
    const b = initialBoard();
    const snapshot = b.slice();
    applyMove(b, 0, "south");
    expect(b).toEqual(snapshot);
  });

  it("sows counter-clockwise one seed per pit", () => {
    const b = initialBoard();
    const { board } = applyMove(b, 0, "south"); // 4 seeds from pit 0 → pits 1,2,3,4
    expect(board[0]).toBe(0);
    expect(board[1]).toBe(5);
    expect(board[2]).toBe(5);
    expect(board[3]).toBe(5);
    expect(board[4]).toBe(5);
    expect(board[5]).toBe(4);
  });

  it("grants an extra turn when the last seed lands in the mover's store", () => {
    const b = initialBoard();
    // South pit 2 has 4 seeds → lands in pits 3,4,5 and store(6). Extra turn.
    const r = applyMove(b, 2, "south");
    expect(r.lastIndex).toBe(STORE.south);
    expect(r.extraTurn).toBe(true);
    expect(r.board[STORE.south]).toBe(1);
  });

  it("skips the opponent's store while sowing", () => {
    const b = initialBoard();
    b[5] = 9; // enough to wrap past north's store (13)
    const { board } = applyMove(b, 5, "south");
    // North store (13) must remain untouched by South's sowing.
    expect(board[STORE.north]).toBe(0);
  });

  it("captures from the opposite pit when landing in an own empty pit", () => {
    const b = new Array(14).fill(0);
    b[0] = 1; // south plays its only seed
    b[1] = 0; // lands here, was empty
    b[11] = 5; // opposite of pit 1 (12 - 1 = 11)
    const r = applyMove(b, 0, "south");
    expect(r.lastIndex).toBe(1);
    expect(r.captured).toBe(6); // 5 opposite + 1 landing seed
    expect(r.board[STORE.south]).toBe(6);
    expect(r.board[1]).toBe(0);
    expect(r.board[11]).toBe(0);
  });

  it("does not capture when the opposite pit is empty", () => {
    const b = new Array(14).fill(0);
    b[0] = 1;
    b[11] = 0;
    const r = applyMove(b, 0, "south");
    expect(r.captured).toBe(0);
    expect(r.board[1]).toBe(1);
  });

  it("rejects illegal moves", () => {
    const b = initialBoard();
    expect(() => applyMove(b, 6, "south")).toThrow(); // store, not a pit
    expect(() => applyMove(b, 7, "south")).toThrow(); // north's pit
    b[0] = 0;
    expect(() => applyMove(b, 0, "south")).toThrow(); // empty pit
  });
});

describe("end of game", () => {
  it("detects a finished side and sweeps remaining seeds on finalize", () => {
    const b = new Array(14).fill(0);
    PITS.north.forEach((p) => (b[p] = 0));
    b[0] = 3;
    b[2] = 1;
    b[STORE.south] = 10;
    b[STORE.north] = 20;
    expect(isGameOver(b)).toBe(true);
    const final = finalize(b);
    expect(final[STORE.south]).toBe(14); // 10 + 3 + 1
    expect(PITS.south.every((p) => final[p] === 0)).toBe(true);
    expect(winner(final)).toBe("north");
  });

  it("conserves total seeds across any move", () => {
    let b = initialBoard();
    const total = () => b.reduce((a, c) => a + c, 0);
    b = applyMove(b, 1, "south").board;
    b = applyMove(b, 9, "north").board;
    expect(total()).toBe(48);
  });
});

describe("legalMoves", () => {
  it("excludes empty pits", () => {
    const b = initialBoard();
    b[0] = 0;
    expect(legalMoves(b, "south")).toEqual([1, 2, 3, 4, 5]);
  });
});
