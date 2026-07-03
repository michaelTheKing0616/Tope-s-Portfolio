import {
  getCareerPaths,
  getClub,
  getClubs,
  getPlayer,
  getPlayers,
  getSpeedQuestions,
  getTrueFalse,
  poolCount,
  randomItem,
  shuffle,
  type CareerPathEntry,
  type Club,
  type Player,
} from "@sportverse/sports-db";
import {
  coinsFromQuiz,
  type CareerPathState,
  type QuizMode,
  type QuizResult,
  type SpeedRoundState,
  type WhoAmIState,
  speedRoundMultiplier,
  whoAmIScore,
  xpFromQuiz,
} from "./types.js";
import { IdDeck, IndexDeck, shuffleIndices } from "./session-deck.js";
import { fuzzyNameEquals, whoAmIGuessMatches } from "./name-match.js";

export * from "./types.js";
export { IdDeck, IndexDeck, shuffleIndices };
export { normalizeAnswer, whoAmIGuessMatches, fuzzyNameEquals, maxEditDistance } from "./name-match.js";

export function createWhoAmIDeck(): IdDeck<Player> {
  return new IdDeck(getPlayers());
}

export function createGuessClubDeck(): IdDeck<Club> {
  return new IdDeck(getClubs());
}

export function createTrueFalseDeck(): IdDeck<ReturnType<typeof getTrueFalse>[number]> {
  return new IdDeck(getTrueFalse());
}

export function createCareerPathDeck(): IdDeck<CareerPathEntry> {
  return new IdDeck(getCareerPaths());
}

export function createSpeedQuestionDeck(): IdDeck<ReturnType<typeof getSpeedQuestions>[number]> {
  return new IdDeck(getSpeedQuestions());
}

export function contentPoolSize(): number {
  return poolCount();
}

export function startWhoAmI(playerId?: string): WhoAmIState & { player: Player } {
  const player = playerId ? getPlayer(playerId) : randomItem(getPlayers());
  if (!player) throw new Error("No players in database");
  return { playerId: player.id, cluesRevealed: 1, answered: false, correct: false, player };
}

export function revealNextClue(state: WhoAmIState): WhoAmIState {
  const player = getPlayer(state.playerId);
  const max = player?.clues.length ?? 5;
  return { ...state, cluesRevealed: Math.min(state.cluesRevealed + 1, max) };
}

export function answerWhoAmI(state: WhoAmIState, guess: string): QuizResult {
  const player = getPlayer(state.playerId);
  const correct = whoAmIGuessMatches(player?.name ?? "", guess);
  const score = correct ? whoAmIScore(state.cluesRevealed - 1) : 0;
  return {
    mode: "who-am-i",
    score,
    maxScore: 1000,
    correct,
    xpEarned: xpFromQuiz(score, "who-am-i"),
    coinsEarned: coinsFromQuiz(score),
    details: correct ? `Identified in ${state.cluesRevealed} clue(s)` : `Answer: ${player?.name}`,
  };
}

export function startGuessClub(clubId?: string): { club: Club; cluesRevealed: number } {
  const club = clubId ? getClub(clubId) : randomItem(getClubs());
  if (!club) throw new Error("No clubs in database");
  return { club, cluesRevealed: 1 };
}

export function answerGuessClub(club: Club, cluesRevealed: number, guess: string): QuizResult {
  const correct = fuzzyNameEquals(club.name, guess) || whoAmIGuessMatches(club.name, guess);
  const score = correct ? whoAmIScore(cluesRevealed - 1) : 0;
  return {
    mode: "guess-club",
    score,
    maxScore: 1000,
    correct,
    xpEarned: xpFromQuiz(score, "guess-club"),
    coinsEarned: coinsFromQuiz(score),
  };
}

export function startTrueFalse() {
  return randomItem(getTrueFalse());
}

export function answerTrueFalse(statementId: string, answer: boolean): QuizResult {
  const stmt = getTrueFalse().find((s) => s.id === statementId);
  if (!stmt) throw new Error("Statement not found");
  const correct = stmt.answer === answer;
  const score = correct ? 200 : 0;
  return {
    mode: "true-false",
    score,
    maxScore: 200,
    correct,
    xpEarned: xpFromQuiz(score, "true-false"),
    coinsEarned: coinsFromQuiz(score),
    details: stmt.explanation,
  };
}

export function startSpeedRound(durationMs = 60_000): SpeedRoundState {
  return { timeLeftMs: durationMs, combo: 0, score: 0, questionsAnswered: 0 };
}

export function nextSpeedQuestion(): ReturnType<typeof randomItem<ReturnType<typeof getSpeedQuestions>[number]>> {
  return randomItem(getSpeedQuestions());
}

export function answerSpeedQuestion(
  state: SpeedRoundState,
  questionId: string,
  optionIndex: number,
): { state: SpeedRoundState; result: QuizResult } {
  const q = getSpeedQuestions().find((x) => x.id === questionId);
  if (!q) throw new Error("Question not found");
  const correct = q.answerIndex === optionIndex;
  const combo = correct ? state.combo + 1 : 0;
  const points = correct ? Math.round(100 * speedRoundMultiplier(combo)) : 0;
  const next: SpeedRoundState = {
    ...state,
    combo,
    score: state.score + points,
    questionsAnswered: state.questionsAnswered + 1,
  };
  return {
    state: next,
    result: {
      mode: "speed-round",
      score: points,
      maxScore: 200,
      correct,
      xpEarned: correct ? 5 : 0,
      coinsEarned: correct ? 1 : 0,
    },
  };
}

export function finalizeSpeedRound(state: SpeedRoundState): QuizResult {
  return {
    mode: "speed-round",
    score: state.score,
    maxScore: state.questionsAnswered * 200,
    correct: state.score > 0,
    xpEarned: xpFromQuiz(state.score, "speed-round"),
    coinsEarned: coinsFromQuiz(state.score),
    details: `${state.questionsAnswered} answered, best combo ${state.combo}`,
  };
}

export function startCareerPath(pathId?: string): CareerPathState & { entry: CareerPathEntry; shuffled: string[] } {
  const entry = pathId
    ? getCareerPaths().find((p) => p.id === pathId)
    : randomItem(getCareerPaths());
  if (!entry) throw new Error("No career path");
  return {
    pathId: entry.id,
    playerOrder: [],
    submitted: false,
    correct: false,
    entry,
    shuffled: shuffle(entry.clubs),
  };
}

export function submitCareerPath(state: CareerPathState, order: string[]): QuizResult {
  const entry = getCareerPaths().find((p) => p.id === state.pathId);
  if (!entry) throw new Error("Path not found");
  const correct = order.every((c, i) => c === entry.clubs[i]);
  const score = correct ? 800 : Math.max(0, 800 - 150 * countMisplaced(order, entry.clubs));
  return {
    mode: "career-path",
    score,
    maxScore: 800,
    correct,
    xpEarned: xpFromQuiz(score, "career-path"),
    coinsEarned: coinsFromQuiz(score),
  };
}

function countMisplaced(order: string[], correct: string[]): number {
  let n = 0;
  for (let i = 0; i < correct.length; i++) {
    if (order[i] !== correct[i]) n++;
  }
  return n;
}

export const QUIZ_MODES: { id: QuizMode; title: string; blurb: string }[] = [
  { id: "who-am-i", title: "Who Am I?", blurb: "Identify real players from progressive clues drawn from the full archive." },
  { id: "speed-round", title: "Speed Round", blurb: "60 seconds — thousands of procedurally generated football facts." },
  { id: "guess-club", title: "Guess the Club", blurb: "Decode real clubs from database-backed hints." },
  { id: "career-path", title: "Career Path", blurb: "Order real club histories from season-stat timelines." },
  { id: "true-false", title: "True or False", blurb: "Stat-verified claims with explanations — curated + procedural." },
];
