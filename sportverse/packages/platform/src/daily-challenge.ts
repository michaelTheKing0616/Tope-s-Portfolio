/** Shared daily draft rotation — keep API and client in sync. */
export const DAILY_CHALLENGE_MODE_IDS = [
  "all-time-any",
  "premier-league",
  "international",
  "decade-2010s",
  "continental-cl",
] as const;

export function resolveDailyChallengeModeId(day = new Date().toISOString().slice(0, 10)): string {
  const idx = day.split("-").reduce((a, b) => a + Number(b), 0) % DAILY_CHALLENGE_MODE_IDS.length;
  return DAILY_CHALLENGE_MODE_IDS[idx]!;
}

export function resolveDailyChallengeSeed(day = new Date().toISOString().slice(0, 10)) {
  return { day, modeId: resolveDailyChallengeModeId(day) };
}
