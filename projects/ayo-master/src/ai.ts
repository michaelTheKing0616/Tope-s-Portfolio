/**
 * Adversarial-search AI for Ayo Master: minimax with alpha-beta pruning over the
 * pure engine. North is the maximising side (the computer); south is minimising.
 *
 * The extra-turn rule means a move does not always pass the turn, so the search
 * tracks whose turn it is rather than assuming strict alternation.
 */

import {
  type Board,
  type Player,
  PITS,
  STORE,
  applyMove,
  legalMoves,
  isGameOver,
  finalize,
} from "./engine.js";

export type Difficulty = "easy" | "medium" | "hard";

const DEPTH: Record<Difficulty, number> = { easy: 2, medium: 5, hard: 9 };

/** Heuristic value of a board from North's perspective. */
export function evaluate(board: Board): number {
  const b = isGameOver(board) ? finalize(board) : board;
  // Banked seeds dominate; on-board material is a mild tie-breaker.
  let score = (b[STORE.north]! - b[STORE.south]!) * 2;
  for (const pit of PITS.north) score += b[pit]! * 0.1;
  for (const pit of PITS.south) score -= b[pit]! * 0.1;
  return score;
}

export function minimax(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  side: Player,
): number {
  if (depth === 0 || isGameOver(board)) return evaluate(board);

  const moves = legalMoves(board, side);
  if (moves.length === 0) return evaluate(finalize(board));

  if (side === "north") {
    let best = -Infinity;
    for (const move of moves) {
      const r = applyMove(board, move, "north");
      const nextSide: Player = r.extraTurn ? "north" : "south";
      best = Math.max(best, minimax(r.board, depth - 1, alpha, beta, nextSide));
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break; // prune
    }
    return best;
  }

  let best = Infinity;
  for (const move of moves) {
    const r = applyMove(board, move, "south");
    const nextSide: Player = r.extraTurn ? "south" : "north";
    best = Math.min(best, minimax(r.board, depth - 1, alpha, beta, nextSide));
    beta = Math.min(beta, best);
    if (beta <= alpha) break; // prune
  }
  return best;
}

export interface ChooseOptions {
  difficulty?: Difficulty;
  /** Inject randomness for testing; defaults to Math.random. */
  rng?: () => number;
}

/**
 * Choose a move for `side`. Easy occasionally plays randomly so beginners can
 * win; medium/hard search deeper and play the best line.
 */
export function chooseMove(board: Board, side: Player, opts: ChooseOptions = {}): number {
  const { difficulty = "medium", rng = Math.random } = opts;
  const moves = legalMoves(board, side);
  if (moves.length === 0) throw new Error("No legal moves available");

  if (difficulty === "easy" && rng() < 0.45) {
    return moves[Math.floor(rng() * moves.length)]!;
  }

  const depth = DEPTH[difficulty];
  const maximizing = side === "north";
  let best = moves[0]!;
  let bestVal = maximizing ? -Infinity : Infinity;

  for (const move of moves) {
    const r = applyMove(board, move, side);
    const nextSide: Player = r.extraTurn ? side : side === "north" ? "south" : "north";
    const val = minimax(r.board, depth - 1, -Infinity, Infinity, nextSide);
    if (maximizing ? val > bestVal : val < bestVal) {
      bestVal = val;
      best = move;
    }
  }
  return best;
}
