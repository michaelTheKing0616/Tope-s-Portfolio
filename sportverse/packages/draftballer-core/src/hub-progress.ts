import type { DraftModeConfig, SeasonSimResult } from "@sportverse/draftballer-types";
import { PRESET_MODES, getPresetMode } from "./modes.js";
import { loadTrophies } from "./trophy-case.js";

const PROGRESS_KEY = "db_hub_progress";

export interface HubProgress {
  bestPoints: number;
  bestRecord: string;
  dailyStreak: number;
  lastDailyDay: string | null;
  lastSeasonAt: string | null;
}

const EMPTY: HubProgress = {
  bestPoints: 0,
  bestRecord: "—",
  dailyStreak: 0,
  lastDailyDay: null,
  lastSeasonAt: null,
};

export function loadHubProgress(): HubProgress {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? "{}") };
  } catch {
    return { ...EMPTY };
  }
}

function saveHubProgress(p: HubProgress): void {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
}

/** ISO week number (UTC), 1–53. Hand-check: 2026-01-05 → week 2. */
export function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

const FEATURED_POOL = PRESET_MODES.filter((m) => m.id !== "custom");

/** One featured preset per ISO week — deterministic rotation. */
export function featuredModeForDate(date = new Date()): DraftModeConfig {
  const week = isoWeekNumber(date);
  const year = date.getUTCFullYear();
  // Mix year so rotations don't repeat the same week-index every year.
  const idx = (week + year) % FEATURED_POOL.length;
  return FEATURED_POOL[idx] ?? getPresetMode("all-time-any");
}

export function recordSeasonProgress(result: SeasonSimResult): void {
  const p = loadHubProgress();
  const record = `${result.won}W-${result.drawn}D-${result.lost}L`;
  if (result.points > p.bestPoints) {
    p.bestPoints = result.points;
    p.bestRecord = record;
  }
  p.lastSeasonAt = new Date().toISOString();
  saveHubProgress(p);
}

/** Call when the player finishes today's daily challenge. */
export function recordDailyPlay(day = new Date().toISOString().slice(0, 10)): void {
  const p = loadHubProgress();
  if (p.lastDailyDay === day) {
    saveHubProgress(p);
    return;
  }
  if (p.lastDailyDay) {
    const prev = new Date(p.lastDailyDay + "T12:00:00Z");
    const cur = new Date(day + "T12:00:00Z");
    const diffDays = Math.round((cur.getTime() - prev.getTime()) / 86400000);
    p.dailyStreak = diffDays === 1 ? p.dailyStreak + 1 : 1;
  } else {
    p.dailyStreak = 1;
  }
  p.lastDailyDay = day;
  saveHubProgress(p);
}

export function latestTrophyTitle(): string | null {
  const t = loadTrophies()[0];
  return t?.title ?? null;
}
