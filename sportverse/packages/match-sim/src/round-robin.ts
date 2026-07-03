import type {
  MatchEvent,
  RoundRobinFixture,
  RoundRobinResult,
  RoundRobinStanding,
  SimMatchConfig,
  SimSquadInput,
} from "@sportverse/draftballer-types";
import { DEFAULT_SIM_CONFIG } from "@sportverse/draftballer-types";
import { simulateMatchV2 } from "./sim-engine.js";

export interface RoundRobinTeam {
  id: string;
  name: string;
  squad: SimSquadInput;
}

export interface RoundRobinOptions {
  simConfig?: Partial<SimMatchConfig>;
  /** Single round-robin (default) or home-and-away double round-robin. */
  doubleRound?: boolean;
  statsFor?: (playerId: string) => import("@sportverse/sports-db").PlayerSeasonStat[];
}

function buildSchedule(teamIds: string[], double: boolean): [string, string][] {
  const ids = [...teamIds];
  if (ids.length % 2 === 1) ids.push("__bye__");
  const n = ids.length;
  const rounds: [string, string][] = [];

  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < n / 2; i++) {
      const home = ids[i]!;
      const away = ids[n - 1 - i]!;
      if (home !== "__bye__" && away !== "__bye__") rounds.push([home, away]);
    }
    const fixed = ids[0]!;
    const rotated = [fixed, ids[n - 1]!, ...ids.slice(1, n - 1)];
    ids.splice(0, ids.length, ...rotated);
  }

  if (!double) return rounds;

  const reverse = rounds.map(([h, a]) => [a, h] as [string, string]);
  return [...rounds, ...reverse];
}

function initStandings(teams: RoundRobinTeam[]): Map<string, RoundRobinStanding> {
  const map = new Map<string, RoundRobinStanding>();
  for (const t of teams) {
    map.set(t.id, {
      teamId: t.id,
      name: t.name,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
      goalDifference: 0,
    });
  }
  return map;
}

function applyResult(
  standings: Map<string, RoundRobinStanding>,
  homeId: string,
  awayId: string,
  homeGoals: number,
  awayGoals: number,
): void {
  const home = standings.get(homeId)!;
  const away = standings.get(awayId)!;

  home.played++;
  away.played++;
  home.goalsFor += homeGoals;
  home.goalsAgainst += awayGoals;
  away.goalsFor += awayGoals;
  away.goalsAgainst += homeGoals;

  if (homeGoals > awayGoals) {
    home.won++;
    home.points += 3;
    away.lost++;
  } else if (homeGoals < awayGoals) {
    away.won++;
    away.points += 3;
    home.lost++;
  } else {
    home.drawn++;
    away.drawn++;
    home.points++;
    away.points++;
  }

  home.goalDifference = home.goalsFor - home.goalsAgainst;
  away.goalDifference = away.goalsFor - away.goalsAgainst;
}

/** Round-robin mini-league — each team plays every other team once (or twice). */
export function simulateRoundRobin(
  teams: RoundRobinTeam[],
  seed: string,
  options: RoundRobinOptions = {},
): RoundRobinResult {
  if (teams.length < 3) throw new Error("Round-robin requires at least 3 teams");

  const simConfig = { ...DEFAULT_SIM_CONFIG, ...options.simConfig };
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const schedule = buildSchedule(teams.map((t) => t.id), options.doubleRound ?? false);
  const standings = initStandings(teams);
  const fixtures: RoundRobinFixture[] = [];

  schedule.forEach(([homeId, awayId], idx) => {
    const home = teamMap.get(homeId)!;
    const away = teamMap.get(awayId)!;
    const match = simulateMatchV2(home.squad, away.squad, `${seed}:md${idx + 1}`, idx + 1, {
      config: simConfig,
      statsFor: options.statsFor,
    });

    applyResult(standings, homeId, awayId, match.homeGoals, match.awayGoals);

    const goalEvents = match.events.filter((e) => e.type === "goal") as MatchEvent[];

    fixtures.push({
      matchday: idx + 1,
      homeTeamId: homeId,
      awayTeamId: awayId,
      homeName: home.name,
      awayName: away.name,
      homeGoals: match.homeGoals,
      awayGoals: match.awayGoals,
      events: goalEvents,
    });
  });

  const table = [...standings.values()].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    return b.goalsFor - a.goalsFor;
  });

  const champion = table[0]!;

  return {
    fixtures,
    standings: table,
    championTeamId: champion.teamId,
    championName: champion.name,
    seed,
  };
}
