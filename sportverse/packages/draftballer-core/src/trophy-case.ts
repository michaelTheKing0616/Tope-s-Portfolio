import type { SeasonSimResult } from "@sportverse/draftballer-types";

export interface TrophyEntry {
  id: string;
  title: string;
  detail: string;
  earnedAt: string;
}

const KEY = "db_trophy_case";

export function loadTrophies(): TrophyEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveTrophy(entry: TrophyEntry): void {
  const list = loadTrophies();
  if (list.some((t) => t.id === entry.id)) return;
  localStorage.setItem(KEY, JSON.stringify([entry, ...list].slice(0, 24)));
}

export function trophiesFromSeason(result: SeasonSimResult, modeTitle: string): TrophyEntry[] {
  const earned: TrophyEntry[] = [];
  const now = new Date().toISOString();
  if (result.isPerfect) {
    earned.push({
      id: `perfect_${now.slice(0, 10)}`,
      title: "38-0 Perfect Season",
      detail: `${modeTitle} · ${result.points} pts`,
      earnedAt: now,
    });
  } else if (result.isUnbeaten) {
    earned.push({
      id: `unbeaten_${now.slice(0, 10)}`,
      title: "Unbeaten Season",
      detail: `${result.won}W ${result.drawn}D · ${result.points} pts`,
      earnedAt: now,
    });
  }
  if (result.points >= 90) {
    earned.push({
      id: `points90_${now.slice(0, 10)}`,
      title: "Title Contender",
      detail: `${result.points} points in ${modeTitle}`,
      earnedAt: now,
    });
  }
  return earned;
}

export function recordSeasonTrophies(result: SeasonSimResult, modeTitle: string): void {
  for (const t of trophiesFromSeason(result, modeTitle)) saveTrophy(t);
}
