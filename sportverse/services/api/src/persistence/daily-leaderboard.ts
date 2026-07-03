import { FileStore, resolveDataPath } from "./file-store.js";

export interface DailyScoreEntry {
  name: string;
  ovr: number;
  squadRating?: number;
  at: string;
}

type DailyStore = Record<string, DailyScoreEntry[]>;

const store = new FileStore<DailyStore>(resolveDataPath("daily-leaderboard.json"));

export function getDailyScores(day: string): DailyScoreEntry[] {
  return store.read()[day] ?? [];
}

export function addDailyScore(day: string, entry: DailyScoreEntry): { rank: number; top: DailyScoreEntry[] } {
  const data = store.update((current) => {
    const list = [...(current[day] ?? []), entry].sort((a, b) => (b.squadRating ?? b.ovr) - (a.squadRating ?? a.ovr));
    return { ...current, [day]: list.slice(0, 100) };
  });
  const list = data[day] ?? [];
  return { rank: list.findIndex((x) => x.name === entry.name && x.at === entry.at) + 1, top: list };
}
