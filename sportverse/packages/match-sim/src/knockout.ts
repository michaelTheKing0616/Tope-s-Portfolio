import type { SimMatchConfig, SimSquadInput } from "@sportverse/draftballer-types";
import { DEFAULT_SIM_CONFIG } from "@sportverse/draftballer-types";
import { simulateMatchV2 } from "./sim-engine.js";

export interface KnockoutSquad {
  id: string;
  name: string;
  seed: number;
  squad: SimSquadInput;
}

export interface KnockoutMatch {
  round: string;
  leg: number;
  home: KnockoutSquad;
  away: KnockoutSquad;
  homeGoals: number;
  awayGoals: number;
  aggregateHome?: number;
  aggregateAway?: number;
  events: ReturnType<typeof simulateMatchV2>["events"];
}

export interface KnockoutResult {
  rounds: KnockoutMatch[][];
  champion: KnockoutSquad;
  bracket: { round: string; winners: string[] }[];
}

export interface KnockoutOptions {
  simConfig?: Partial<SimMatchConfig>;
  twoLegged?: boolean;
  twoLeggedFromRound?: string;
}

function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function resolveTwoLeggedTie(
  leg1: ReturnType<typeof simulateMatchV2>,
  leg2: ReturnType<typeof simulateMatchV2>,
  squadA: KnockoutSquad,
  squadB: KnockoutSquad,
): KnockoutSquad {
  const aggA = leg1.homeGoals + leg2.awayGoals;
  const aggB = leg1.awayGoals + leg2.homeGoals;
  if (aggA > aggB) return squadA;
  if (aggB > aggA) return squadB;
  if (leg2.awayGoals > leg1.awayGoals) return squadA;
  if (leg1.awayGoals > leg2.awayGoals) return squadB;
  return leg2.homeGoals >= leg2.awayGoals ? squadB : squadA;
}

function playTie(
  home: KnockoutSquad,
  away: KnockoutSquad,
  seed: string,
  matchday: number,
  simConfig: Partial<SimMatchConfig>,
  twoLegged: boolean,
): { winner: KnockoutSquad; matches: KnockoutMatch[] } {
  const leg1 = simulateMatchV2(home.squad, away.squad, `${seed}:leg1`, matchday, {
    config: { ...DEFAULT_SIM_CONFIG, ...simConfig, isKnockout: true },
  });
  const matches: KnockoutMatch[] = [
    {
      round: "",
      leg: 1,
      home,
      away,
      homeGoals: leg1.homeGoals,
      awayGoals: leg1.awayGoals,
      events: leg1.events,
    },
  ];

  if (!twoLegged) {
    const winner = leg1.homeGoals >= leg1.awayGoals ? home : away;
    return { winner, matches };
  }

  const leg2 = simulateMatchV2(away.squad, home.squad, `${seed}:leg2`, matchday + 1, {
    config: { ...DEFAULT_SIM_CONFIG, ...simConfig, isKnockout: true },
  });
  matches.push({
    round: "",
    leg: 2,
    home: away,
    away: home,
    homeGoals: leg2.homeGoals,
    awayGoals: leg2.awayGoals,
    aggregateHome: leg1.homeGoals + leg2.awayGoals,
    aggregateAway: leg1.awayGoals + leg2.homeGoals,
    events: leg2.events,
  });

  return { winner: resolveTwoLeggedTie(leg1, leg2, home, away), matches };
}

/** Knockout bracket with optional two-legged ties (KNOWN_SIMPLIFICATIONS upgrade). */
export function simulateKnockoutBracket(
  squads: KnockoutSquad[],
  seed: string,
  options: KnockoutOptions | Partial<SimMatchConfig> = {},
): KnockoutResult {
  const opts: KnockoutOptions =
    "simulationMode" in options || "eraContext" in options ? { simConfig: options } : options;
  const simConfig = opts.simConfig ?? {};
  const twoLeggedFrom = opts.twoLeggedFromRound ?? "Quarter-Final";

  if (squads.length < 2) throw new Error("Need at least 2 squads");

  const sorted = [...squads].sort((a, b) => a.seed - b.seed);
  const size = nextPowerOfTwo(sorted.length);
  while (sorted.length < size) {
    sorted.push({
      id: `bye-${sorted.length}`,
      name: "BYE",
      seed: 999,
      squad: sorted[sorted.length - 1]!.squad,
    });
  }

  let roundSquads = sorted;
  const allRounds: KnockoutMatch[][] = [];
  const bracket: KnockoutResult["bracket"] = [];
  const roundNames = ["Round of 16", "Quarter-Final", "Semi-Final", "Final"];
  let roundIdx = 0;

  while (roundSquads.length > 1) {
    const roundLabel = roundNames[roundIdx] ?? `Round ${roundIdx + 1}`;
    const twoLegged = !!opts.twoLegged && roundNames.indexOf(roundLabel) >= roundNames.indexOf(twoLeggedFrom);
    const matches: KnockoutMatch[] = [];
    const winners: KnockoutSquad[] = [];

    for (let i = 0; i < roundSquads.length; i += 2) {
      const home = roundSquads[i]!;
      const away = roundSquads[i + 1]!;
      if (away.name === "BYE") {
        winners.push(home);
        continue;
      }
      const tie = playTie(home, away, `${seed}:${roundLabel}:${i}`, roundIdx + 1, simConfig, twoLegged);
      winners.push(tie.winner);
      matches.push(...tie.matches.map((m) => ({ ...m, round: roundLabel })));
    }

    allRounds.push(matches);
    bracket.push({ round: roundLabel, winners: winners.map((w) => w.name) });
    roundSquads = winners;
    roundIdx++;
  }

  return {
    rounds: allRounds,
    champion: roundSquads[0]!,
    bracket,
  };
}
