import { getPresetMode } from "./modes.js";
import { dailyChallengeSeed } from "./rng.js";

/** Shared daily draft rotation — keep API and client in sync. */
export const DAILY_CHALLENGE_MODE_IDS = [
  "all-time-any",
  "premier-league",
  "international",
  "decade-2010s",
  "continental-cl",
] as const;

export type DailyChallengeModeId = (typeof DAILY_CHALLENGE_MODE_IDS)[number];

export function dailyChallengeDaySeed(day = new Date().toISOString().slice(0, 10)): number {
  return day.split("-").reduce((a, b) => a + Number(b), 0);
}

export function resolveDailyChallengeModeId(day = new Date().toISOString().slice(0, 10)): DailyChallengeModeId {
  const idx = dailyChallengeDaySeed(day) % DAILY_CHALLENGE_MODE_IDS.length;
  return DAILY_CHALLENGE_MODE_IDS[idx]!;
}

export function resolveDailyChallenge(day = new Date().toISOString().slice(0, 10)) {
  const modeId = resolveDailyChallengeModeId(day);
  const d = new Date(day + "T12:00:00Z");
  return {
    day,
    modeId,
    mode: { ...getPresetMode(modeId), id: `daily-${day}` },
    wheelSeed: dailyChallengeSeed(d),
  };
}
