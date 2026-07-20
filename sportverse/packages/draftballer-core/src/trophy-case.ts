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
  if (result.isPerfect) {
    earned.push({
      id: "achievement_first_38_0",
      title: "First 38-0",
      detail: "The impossible dream — achieved",
      earnedAt: now,
    });
  }
  return earned;
}

export function checkDraftAchievements(players: import("@sportverse/draftballer-types").RatedPlayerCard[]): TrophyEntry[] {
  const earned: TrophyEntry[] = [];
  const now = new Date().toISOString();
  const icons = players.filter((p) => p.fameTier === "icon").length;
  const avg = players.reduce((s, p) => s + p.ovr, 0) / (players.length || 1);
  const brazilians = players.filter((p) => p.nationality.includes("Brazil")).length;

  if (icons === 0) {
    earned.push({ id: `no_icons_${now.slice(0, 10)}`, title: "No Icons Needed", detail: "Unbeaten without a single icon", earnedAt: now });
  }
  if (brazilians >= 5) {
    earned.push({ id: `all_brazil_${now.slice(0, 10)}`, title: "All-Brazilian XI", detail: "Samba squad assembled", earnedAt: now });
  }
  if (avg < 80 && players.length >= 11) {
    earned.push({ id: `sub80_${now.slice(0, 10)}`, title: "Against the Odds", detail: `Won with ${Math.round(avg)} avg OVR`, earnedAt: now });
  }
  return earned;
}

export function recordSeasonTrophies(result: SeasonSimResult, modeTitle: string): void {
  for (const t of trophiesFromSeason(result, modeTitle)) saveTrophy(t);
}
