import type { QuizMode } from "./types.js";
import { answerGuessClub, answerTrueFalse, answerWhoAmI, startGuessClub, startTrueFalse, startWhoAmI } from "./index.js";
import { getTimeline, getXiPuzzle, scoreTimeline, scoreXi } from "./extended.js";
import { MATCH_TIMELINES, XI_PUZZLES } from "./extended.js";
import { randomItem } from "@sportverse/sports-db";
import { xpFromQuiz, coinsFromQuiz } from "./types.js";

export type DecathlonSport = "football" | "basketball" | "cricket" | "tennis" | "f1";

export interface DecathlonRound {
  index: number;
  sport: DecathlonSport;
  prompt: string;
  type: "who-am-i" | "true-false" | "timeline" | "xi" | "trivia";
  payload: unknown;
}

export interface DecathlonState {
  rounds: DecathlonRound[];
  current: number;
  combo: number;
  totalScore: number;
}

const TRIVIA = [
  { q: "How many players on a cricket team?", options: ["9", "10", "11", "12"], a: 2 },
  { q: "F1 Monaco GP is held in which country?", options: ["France", "Monaco", "Italy", "Spain"], a: 1 },
  { q: "Tennis Grand Slams per year?", options: ["3", "4", "5", "6"], a: 1 },
];

export function startDecathlon(): DecathlonState {
  const rounds: DecathlonRound[] = [
    { index: 0, sport: "football", prompt: "Identify the player", type: "who-am-i", payload: startWhoAmI() },
    { index: 1, sport: "football", prompt: "True or false?", type: "true-false", payload: startTrueFalse() },
    { index: 2, sport: "football", prompt: "Order match events", type: "timeline", payload: randomItem(MATCH_TIMELINES) },
    { index: 3, sport: "basketball", prompt: "Build the XI", type: "xi", payload: randomItem(XI_PUZZLES) },
    { index: 4, sport: "cricket", prompt: "Quick trivia", type: "trivia", payload: randomItem(TRIVIA) },
    { index: 5, sport: "tennis", prompt: "Guess the club", type: "who-am-i", payload: startGuessClub() },
    { index: 6, sport: "f1", prompt: "Quick trivia", type: "trivia", payload: randomItem(TRIVIA) },
    { index: 7, sport: "football", prompt: "Timeline", type: "timeline", payload: randomItem(MATCH_TIMELINES) },
    { index: 8, sport: "basketball", prompt: "Trivia", type: "trivia", payload: randomItem(TRIVIA) },
    { index: 9, sport: "football", prompt: "Final — True or false", type: "true-false", payload: startTrueFalse() },
  ];
  return { rounds, current: 0, combo: 0, totalScore: 0 };
}

export function answerDecathlonRound(
  state: DecathlonState,
  answer: string | boolean | string[],
): { state: DecathlonState; correct: boolean; score: number; xp: number } {
  const round = state.rounds[state.current]!;
  let correct = false;
  let score = 0;

  switch (round.type) {
    case "who-am-i": {
      if ("player" in (round.payload as object)) {
        const r = answerWhoAmI(round.payload as ReturnType<typeof startWhoAmI>, String(answer));
        correct = r.correct;
        score = r.score;
      } else {
        const r = answerGuessClub(
          (round.payload as ReturnType<typeof startGuessClub>).club,
          1,
          String(answer),
        );
        correct = r.correct;
        score = r.score;
      }
      break;
    }
    case "true-false": {
      const stmt = round.payload as ReturnType<typeof startTrueFalse>;
      const r = answerTrueFalse(stmt.id, Boolean(answer));
      correct = r.correct;
      score = r.score;
      break;
    }
    case "timeline": {
      const puzzle = round.payload as (typeof MATCH_TIMELINES)[number];
      const r = scoreTimeline(puzzle, answer as string[]);
      correct = r.correct;
      score = r.score;
      break;
    }
    case "xi": {
      const puzzle = round.payload as (typeof XI_PUZZLES)[number];
      const r = scoreXi(puzzle, answer as string[]);
      correct = r.correct;
      score = r.score;
      break;
    }
    case "trivia": {
      const t = round.payload as (typeof TRIVIA)[number];
      correct = Number(answer) === t.a;
      score = correct ? 500 : 0;
      break;
    }
  }

  const combo = correct ? state.combo + 1 : 0;
  const mult = 1 + combo * 0.15;
  const roundScore = Math.round(score * mult);
  const next: DecathlonState = {
    ...state,
    combo,
    totalScore: state.totalScore + roundScore,
    current: state.current + 1,
  };
  const xp = Math.round(xpFromQuiz(roundScore, "who-am-i" as QuizMode) * 1.5);
  return { state: next, correct, score: roundScore, xp };
}

export function finalizeDecathlon(state: DecathlonState) {
  return {
    totalScore: state.totalScore,
    maxCombo: state.combo,
    xp: Math.round(state.totalScore / 8),
    coins: coinsFromQuiz(state.totalScore),
    complete: state.current >= state.rounds.length,
  };
}
