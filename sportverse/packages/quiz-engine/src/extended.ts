import { createHmac } from "node:crypto";

export interface MatchEvent {
  id: string;
  label: string;
  minute?: number;
}

export interface MatchTimelinePuzzle {
  id: string;
  title: string;
  events: MatchEvent[];
  correctOrder: string[];
}

export const MATCH_TIMELINES: MatchTimelinePuzzle[] = [
  {
    id: "wc-2014-final",
    title: "2014 World Cup Final",
    events: [
      { id: "e1", label: "Kickoff", minute: 0 },
      { id: "e2", label: "Götze extra-time winner", minute: 113 },
      { id: "e3", label: "Messi Golden Ball", minute: 120 },
      { id: "e4", label: "Palacio chance missed", minute: 88 },
    ],
    correctOrder: ["e1", "e4", "e2", "e3"],
  },
  {
    id: "ucl-1999",
    title: "Champions League Final 1999",
    events: [
      { id: "e1", label: "Kickoff" },
      { id: "e2", label: "Sheringham equalizer", minute: 91 },
      { id: "e3", label: "Solskjær winner", minute: 93 },
      { id: "e4", label: "Bayern lead", minute: 6 },
    ],
    correctOrder: ["e1", "e4", "e2", "e3"],
  },
];

export interface XiPlayer {
  id: string;
  name: string;
  nation: string;
  club: string;
  position: string;
}

export interface XiPuzzle {
  id: string;
  formation: string;
  constraint: string;
  pool: XiPlayer[];
  solution: string[];
}

export const XI_PUZZLES: XiPuzzle[] = [
  {
    id: "xi-pl",
    formation: "4-3-3",
    constraint: "Premier League — max 3 per club",
    pool: [
      { id: "p1", name: "Salah", nation: "Egypt", club: "Liverpool", position: "RW" },
      { id: "p2", name: "Haaland", nation: "Norway", club: "Man City", position: "ST" },
      { id: "p3", name: "Saka", nation: "England", club: "Arsenal", position: "RW" },
      { id: "p4", name: "Rice", nation: "England", club: "Arsenal", position: "DM" },
      { id: "p5", name: "Alisson", nation: "Brazil", club: "Liverpool", position: "GK" },
      { id: "p6", name: "Van Dijk", nation: "Netherlands", club: "Liverpool", position: "CB" },
    ],
    solution: ["p5", "p6", "p2", "p4", "p1", "p3"],
  },
];

export function scoreTimeline(puzzle: MatchTimelinePuzzle, order: string[]): {
  correct: boolean;
  score: number;
  misplaced: number;
} {
  const misplaced = order.filter((id, i) => id !== puzzle.correctOrder[i]).length;
  const correct = misplaced === 0;
  const score = correct ? 800 : Math.max(0, 800 - misplaced * 150);
  return { correct, score, misplaced };
}

export function scoreXi(puzzle: XiPuzzle, selected: string[]): {
  correct: boolean;
  score: number;
  chemistry: number;
} {
  const matchCount = selected.filter((id, i) => puzzle.solution[i] === id).length;
  const correct = matchCount === puzzle.solution.length && selected.length === puzzle.solution.length;
  const clubs = new Map<string, number>();
  for (const id of selected) {
    const p = puzzle.pool.find((x) => x.id === id);
    if (p) clubs.set(p.club, (clubs.get(p.club) ?? 0) + 1);
  }
  const chemistry = [...clubs.values()].every((c) => c <= 3) ? 100 : 60;
  const score = correct ? 900 : Math.round(matchCount * 120 * (chemistry / 100));
  return { correct, score, chemistry };
}

export function getTimeline(id: string) {
  return MATCH_TIMELINES.find((p) => p.id === id);
}

export function getXiPuzzle(id: string) {
  return XI_PUZZLES.find((p) => p.id === id);
}
