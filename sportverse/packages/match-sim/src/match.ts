import type { MatchResult, SimMatchConfig, SimSquadInput } from "@sportverse/draftballer-types";
import { PRIME_POWERS_CONFIG } from "@sportverse/draftballer-types";
import { simulateMatchLegacy } from "./match-legacy.js";
import { simulateMatchV2, type SimulateMatchOptions } from "./sim-engine.js";

export type { SimulateMatchOptions };

/** Backward-compatible match sim — defaults to Prime Powers (legacy §7.1). Pass config for v2. */
export function simulateMatch(
  home: SimSquadInput,
  away: SimSquadInput,
  seed: string,
  matchday: number,
  config?: Partial<SimMatchConfig>,
  options?: Omit<SimulateMatchOptions, "config">,
): MatchResult {
  if (!config || config.simulationMode === "prime_powers") {
    return simulateMatchLegacy(home, away, seed, matchday);
  }
  const v2 = simulateMatchV2(home, away, seed, matchday, { ...options, config });
  return {
    homeGoals: v2.homeGoals,
    awayGoals: v2.awayGoals,
    homeName: v2.homeName,
    awayName: v2.awayName,
    events: v2.events.filter((e) =>
      ["goal", "shot_saved", "chance_missed", "kickoff", "fulltime"].includes(e.type),
    ) as MatchResult["events"],
    mvpPlayerId: v2.mvpPlayerId,
  };
}

export { simulateMatchV2, type SimulateMatchOptions } from "./sim-engine.js";
export { DEFAULT_SIM_CONFIG, PRIME_POWERS_CONFIG } from "@sportverse/draftballer-types";
