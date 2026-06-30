/**
 * Ayoayo / Mancala (Kalah ruleset) — a pure, deterministic rules engine.
 *
 * The engine has no knowledge of rendering, timers or the DOM. That separation
 * is the point: the same functions drive the UI, the AI's look-ahead, and the
 * unit tests, and could just as easily run on a server or in self-play.
 *
 * Board layout (a 14-cell array):
 *   south pits 0..5  | south store 6
 *   north pits 7..12 | north store 13
 * Sowing is counter-clockwise; a player always skips the opponent's store.
 */

export type Player = "south" | "north";
export type Board = number[];

export const STORE: Record<Player, number> = { south: 6, north: 13 };
export const PITS: Record<Player, readonly number[]> = {
  south: [0, 1, 2, 3, 4, 5],
  north: [7, 8, 9, 10, 11, 12],
};

const opponentOf = (side: Player): Player => (side === "south" ? "north" : "south");

/** A fresh board with `seedsPerPit` seeds in every playing pit (stores empty). */
export function initialBoard(seedsPerPit = 4): Board {
  const board = new Array<number>(14).fill(0);
  for (const side of ["south", "north"] as const) {
    for (const pit of PITS[side]) board[pit] = seedsPerPit;
  }
  return board;
}

/** Indices of pits the given side may legally play (non-empty pits on their row). */
export function legalMoves(board: Board, side: Player): number[] {
  return PITS[side].filter((pit) => board[pit]! > 0);
}

export interface MoveResult {
  board: Board;
  /** True when the last seed landed in the mover's own store (play again). */
  extraTurn: boolean;
  /** Index of the pit/store where the last seed landed. */
  lastIndex: number;
  /** Seeds captured this move (0 when no capture occurred). */
  captured: number;
}

/**
 * Apply a move and return a brand-new board (inputs are never mutated).
 * Throws on an illegal move so callers cannot silently corrupt game state.
 */
export function applyMove(board: Board, pit: number, side: Player): MoveResult {
  if (!PITS[side].includes(pit)) throw new Error(`Pit ${pit} is not on ${side}'s row`);
  if (board[pit]! <= 0) throw new Error(`Pit ${pit} is empty`);

  const next = board.slice();
  const store = STORE[side];
  const oppStore = STORE[opponentOf(side)];

  let seeds = next[pit]!;
  next[pit] = 0;
  let idx = pit;
  while (seeds > 0) {
    idx = (idx + 1) % 14;
    if (idx === oppStore) continue; // skip the opponent's store
    next[idx]!++;
    seeds--;
  }

  const extraTurn = idx === store;

  let captured = 0;
  const landedInOwnEmptyPit = PITS[side].includes(idx) && next[idx] === 1;
  if (!extraTurn && landedInOwnEmptyPit) {
    const opposite = 12 - idx; // physical opposite across the board
    if (next[opposite]! > 0) {
      captured = next[opposite]! + 1;
      next[store]! += captured;
      next[opposite] = 0;
      next[idx] = 0;
    }
  }

  return { board: next, extraTurn, lastIndex: idx, captured };
}

/** True when either row is completely empty — the game has ended. */
export function isGameOver(board: Board): boolean {
  const empty = (side: Player) => PITS[side].every((pit) => board[pit] === 0);
  return empty("south") || empty("north");
}

/**
 * Sweep each side's remaining seeds into its own store. Idempotent on a board
 * that is already finalized.
 */
export function finalize(board: Board): Board {
  const next = board.slice();
  for (const side of ["south", "north"] as const) {
    let remaining = 0;
    for (const pit of PITS[side]) {
      remaining += next[pit]!;
      next[pit] = 0;
    }
    next[STORE[side]]! += remaining;
  }
  return next;
}

export function storeCount(board: Board, side: Player): number {
  return board[STORE[side]]!;
}

export type Outcome = "south" | "north" | "draw";

/** Winner of a *finished* (or to-be-finalized) board. */
export function winner(board: Board): Outcome {
  const final = isGameOver(board) ? finalize(board) : board;
  const south = storeCount(final, "south");
  const north = storeCount(final, "north");
  if (south > north) return "south";
  if (north > south) return "north";
  return "draw";
}
