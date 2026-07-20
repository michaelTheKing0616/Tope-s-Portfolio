export type QuizMode =
  | "who-am-i"
  | "speed-round"
  | "guess-club"
  | "career-path"
  | "true-false"
  | "match-timeline"
  | "build-xi"
  | "decathlon";

export interface QuizResult {
  mode: QuizMode;
  score: number;
  maxScore: number;
  correct: boolean;
  xpEarned: number;
  coinsEarned: number;
  details?: string;
}

export interface WhoAmIState {
  playerId: string;
  cluesRevealed: number;
  answered: boolean;
  correct: boolean;
}

export interface SpeedRoundState {
  timeLeftMs: number;
  combo: number;
  score: number;
  questionsAnswered: number;
  currentQuestionId?: string;
}

export interface CareerPathState {
  pathId: string;
  playerOrder: string[];
  submitted: boolean;
  correct: boolean;
}

/** Points by clues already revealed when guessing (index 0 = first clue only). */
export const WHO_AM_I_SCORES = [1000, 850, 700, 550, 400, 300, 200, 100];

export function whoAmIScore(clueIndex: number): number {
  return WHO_AM_I_SCORES[Math.min(clueIndex, WHO_AM_I_SCORES.length - 1)] ?? 100;
}

export function speedRoundMultiplier(combo: number): number {
  return 1 + Math.min(combo, 10) * 0.1;
}

export function xpFromQuiz(score: number, mode: QuizMode): number {
  const base = { "who-am-i": 40, "speed-round": 30, "guess-club": 35, "career-path": 45, "true-false": 20 }[mode];
  return Math.round(base + score / 50);
}

export function coinsFromQuiz(score: number): number {
  return Math.max(1, Math.floor(score / 100));
}
