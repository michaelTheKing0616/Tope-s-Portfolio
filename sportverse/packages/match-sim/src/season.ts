import type {
  FixtureResult,
  SeasonSimResult,
  SimMatchConfig,
  SimSquadInput,
  SimSquadInputV2,
} from "@sportverse/draftballer-types";
import { DEFAULT_SIM_CONFIG } from "@sportverse/draftballer-types";
import { getSeasonStats } from "@sportverse/sports-db";
import { simulateMatchV2 } from "./sim-engine.js";
import { generateOpponents } from "./opponent.js";
import { gradeSeasonVsPrediction, predictSeasonOutlook } from "./season-prediction.js";
import { resolveEraProfile } from "./era-profiles.js";
import { computeSquadFitReport } from "./fit-model.js";

export const SEASON_LENGTH = 38;

export interface SeasonSimOptions {
  config?: Partial<SimMatchConfig>;
  rivalPool?: import("@sportverse/draftballer-types").RatedPlayerCard[];
}

/** Full 38-game league season with optional era-aware sim + fatigue carry (§9). */
export function simulateSeason(
  userSquad: SimSquadInput,
  seed: string,
  rivalPoolOrOptions?: import("@sportverse/draftballer-types").RatedPlayerCard[] | SeasonSimOptions,
): SeasonSimResult {
  const options: SeasonSimOptions = Array.isArray(rivalPoolOrOptions)
    ? { rivalPool: rivalPoolOrOptions }
    : (rivalPoolOrOptions ?? {});
  const config: SimMatchConfig = { ...DEFAULT_SIM_CONFIG, ...options.config };
  const draftDecade = (userSquad as SimSquadInputV2).draftMode?.decade;
  const era = resolveEraProfile(config.eraContext, draftDecade);
  const eraKey = config.simulationMode === "prime_powers" ? "prime_powers" : era.id;
  // Seed discipline: identical draft seed + picks + era → identical season.
  const simSeed = `${seed}:sim:${eraKey}`;

  const opponents = generateOpponents(userSquad, SEASON_LENGTH, simSeed, options.rivalPool);
  const opponentAvgOvr =
    opponents.length > 0
      ? Math.round(opponents.reduce((s, o) => s + o.squadOvr, 0) / opponents.length)
      : 72;
  const prediction = predictSeasonOutlook(userSquad, opponentAvgOvr);
  const fixtures: FixtureResult[] = [];

  let won = 0;
  let drawn = 0;
  let lost = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  const goalScorers = new Map<string, number>();
  const carryFatigue = new Map<string, number>();
  let activeSquad = userSquad;
  const fitAccum = new Map<string, { name: string; base: number; deltaSum: number; n: number }>();

  for (let i = 0; i < SEASON_LENGTH; i++) {
    if (i > 0 && i % 5 === 0) {
      for (const [pid, val] of carryFatigue) {
        if (val > 0) carryFatigue.set(pid, val - 1);
      }
    }

    const isHome = i % 2 === 0;
    const opponent = opponents[i]!;
    const match = isHome
      ? simulateMatchV2(activeSquad, opponent, simSeed, i + 1, {
          config: { ...config, venue: { homeAdvantage: isHome } },
          statsFor: (id) => getSeasonStats(id),
          carryFatigueHome: carryFatigue,
        })
      : simulateMatchV2(opponent, activeSquad, simSeed, i + 1, {
          config: { ...config, venue: { homeAdvantage: false } },
          statsFor: (id) => getSeasonStats(id),
          carryFatigueAway: carryFatigue,
        });

    const userIds = new Set(userSquad.players.map((p) => p.playerId));
    for (const line of match.fitReport) {
      if (!userIds.has(line.playerId)) continue;
      const prev = fitAccum.get(line.playerId) ?? {
        name: line.playerName,
        base: line.baseOvr,
        deltaSum: 0,
        n: 0,
      };
      prev.deltaSum += line.effectiveDelta;
      prev.n += 1;
      fitAccum.set(line.playerId, prev);
    }

    for (const f of match.fitReport) {
      if (f.effectiveDelta < -3) {
        carryFatigue.set(f.playerId, (carryFatigue.get(f.playerId) ?? 0) + 1);
      }
    }

    const userGoals = isHome ? match.homeGoals : match.awayGoals;
    const oppGoals = isHome ? match.awayGoals : match.homeGoals;

    goalsFor += userGoals;
    goalsAgainst += oppGoals;

    let result: FixtureResult["result"] = "D";
    if (userGoals > oppGoals) {
      won++;
      result = "W";
    } else if (userGoals < oppGoals) {
      lost++;
      result = "L";
    } else {
      drawn++;
    }

    for (const ev of match.events) {
      if (ev.type === "goal" && ev.playerName) {
        const isUserGoal = (isHome && ev.team === "home") || (!isHome && ev.team === "away");
        if (isUserGoal && userSquad.players.some((p) => p.name === ev.playerName)) {
          goalScorers.set(ev.playerName, (goalScorers.get(ev.playerName) ?? 0) + 1);
        }
      }
    }

    fixtures.push({
      matchday: i + 1,
      opponent: opponent.name ?? `Match ${i + 1}`,
      home: isHome,
      goalsFor: userGoals,
      goalsAgainst: oppGoals,
      result,
      events: match.events.filter((e) => e.type === "goal" || e.type === "fulltime") as FixtureResult["events"],
    });
  }

  const points = won * 3 + drawn;
  const mvpPlayerId = pickSeasonMvp(userSquad, goalScorers);

  const identity =
    (userSquad as SimSquadInputV2).tacticalIdentity ?? config.tacticalIdentityHome ?? "balanced";
  let seasonFitReport =
    config.simulationMode === "prime_powers"
      ? []
      : fitAccum.size
        ? [...fitAccum.entries()]
            .map(([playerId, acc]) => ({
              playerId,
              playerName: acc.name,
              baseOvr: acc.base,
              effectiveDelta: Math.round(acc.deltaSum / Math.max(1, acc.n)),
              summary: "",
              tags: [] as string[],
            }))
            .sort((a, b) => Math.abs(b.effectiveDelta) - Math.abs(a.effectiveDelta))
        : computeSquadFitReport(userSquad.players, era, identity);

  // Fill plain-language summaries from squad fit preview when match aggregation left them blank.
  if (seasonFitReport.length && seasonFitReport.every((l) => !l.summary)) {
    const preview = computeSquadFitReport(userSquad.players, era, identity);
    const byId = new Map(preview.map((l) => [l.playerId, l]));
    seasonFitReport = seasonFitReport.map((l) => {
      const p = byId.get(l.playerId);
      return p
        ? { ...l, summary: p.summary, tags: p.tags, baseOvr: l.baseOvr || p.baseOvr }
        : l;
    });
  }

  const base: SeasonSimResult = {
    played: SEASON_LENGTH,
    won,
    drawn,
    lost,
    points,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
    fixtures,
    mvpPlayerId,
    mvpPlayerName: userSquad.players.find((p) => p.playerId === mvpPlayerId)?.name,
    isUnbeaten: lost === 0,
    isPerfect: won === SEASON_LENGTH && drawn === 0,
    seed: simSeed,
    prediction,
    seasonFitReport,
    eraProfileId: eraKey,
  };

  return {
    ...base,
    expectationGrade: gradeSeasonVsPrediction(base, prediction),
  };
}

function pickSeasonMvp(
  squad: SimSquadInput,
  goalScorers: Map<string, number>,
): string | undefined {
  if (goalScorers.size) {
    const topScorer = [...goalScorers.entries()].sort((a, b) => b[1] - a[1])[0]![0];
    const player = squad.players.find((p) => p.name === topScorer);
    if (player) return player.playerId;
  }
  return [...squad.players].sort((a, b) => b.ovr - a.ovr)[0]?.playerId;
}
