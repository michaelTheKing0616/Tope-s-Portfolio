import type {
  ExtendedMatchEvent,
  FitReportLine,
  MatchResultV2,
  PlayerSimState,
  SimMatchConfig,
  SimSquadInput,
  SimSquadInputV2,
  ZoneOverloadEvent,
} from "@sportverse/draftballer-types";
import { DEFAULT_SIM_CONFIG, PRIME_POWERS_CONFIG } from "@sportverse/draftballer-types";
import { createRng, type Rng } from "./rng.js";
import { squadStrengths } from "./squad.js";
import { resolveEraProfile } from "./era-profiles.js";
import { computePlayerMeta } from "./player-meta.js";
import {
  buildFitSummary,
  computeFitTerms,
  effectiveAttributes,
  effectiveOvrForPosition,
  fatigueTollProbability,
  pickPhaseZone,
  playerPeakEraId,
} from "./fit-model.js";
import {
  commentaryForV2,
  fitCommentary,
  momentumCommentary,
  overloadCommentary,
  tacticalPreviewHeadline,
} from "./commentary-v2.js";
import {
  buildCommentaryProfile,
  seededCardCommentary,
  seededChanceCommentary,
  seededFatigueCommentary,
  seededFulltimeCommentary,
  seededGoalCommentary,
  seededInjuryCommentary,
  seededKickoffCommentary,
  seededSaveCommentary,
} from "./commentary-seeded.js";
import { getFormation, zoneOverloadModifier } from "./formations.js";
import { assignPlayersToFormationSlots, roleFitModifier } from "./role-fit.js";
import { resolveWeather } from "./weather.js";
import { simulatePenaltyShootout } from "./penalties.js";
import { computeMatchGoalRates } from "./match-rates.js";
import { sampleDixonColesScore } from "./dixon-coles.js";
import type { TacticalIdentity } from "@sportverse/draftballer-types";

const PHASES = 85;
const MOMENTUM_DECAY = 0.92;

/** Small α boost from tactical identity (Sim Engine v2 §3). */
function tacticalAttackBoost(identity: TacticalIdentity): number {
  switch (identity) {
    case "high_press":
      return 0.05;
    case "counter":
      return 0.03;
    case "possession":
      return 0.02;
    case "route_one":
      return -0.02;
    default:
      return 0;
  }
}

function initPlayerStates(players: SimSquadInput["players"], carry?: Map<string, number>): Map<string, PlayerSimState> {
  const map = new Map<string, PlayerSimState>();
  for (const p of players) {
    const carryFatigue = carry?.get(p.playerId) ?? 0;
    map.set(p.playerId, {
      playerId: p.playerId,
      fatigueMultiplier: Math.max(0.7, 1 - carryFatigue * 0.05),
      injured: false,
      sentOff: false,
      carryFatigue,
    });
  }
  return map;
}

function pickScorer(squad: SimSquadInput, rng: Rng): SimSquadInput["players"][number] {
  const attackers = squad.players.filter((p) => ["ST", "W", "AM", "CM"].includes(p.position));
  const pool = attackers.length ? attackers : squad.players;
  const weights = pool.map((p) => p.attributes.sho + p.ovr * 0.3);
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) return pool[i]!;
  }
  return pool[0]!;
}

function profileFor(
  player: SimSquadInput["players"][number],
  statsFor?: (playerId: string) => import("@sportverse/sports-db").PlayerSeasonStat[],
) {
  if (!statsFor) return null;
  const stats = statsFor(player.playerId);
  return buildCommentaryProfile(stats, player.position === "GK");
}

function eventCommentary(
  type: "goal" | "chance_missed" | "shot_saved",
  scorer: SimSquadInput["players"][number],
  minute: number,
  statsFor?: (playerId: string) => import("@sportverse/sports-db").PlayerSeasonStat[],
): string {
  const profile = profileFor(scorer, statsFor);
  if (profile) {
    if (type === "goal") return seededGoalCommentary(scorer.name, minute, profile);
    if (type === "chance_missed") return seededChanceCommentary(scorer.name, minute, profile);
    return seededSaveCommentary(scorer.name, minute, profile);
  }
  return commentaryForV2(type, scorer.name, minute);
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function activeCount(states: Map<string, PlayerSimState>): number {
  let n = 0;
  for (const s of states.values()) if (!s.sentOff && !s.injured) n++;
  return n;
}

export interface SimulateMatchOptions {
  config?: Partial<SimMatchConfig>;
  statsFor?: (playerId: string) => import("@sportverse/sports-db").PlayerSeasonStat[];
  carryFatigueHome?: Map<string, number>;
  carryFatigueAway?: Map<string, number>;
}

/** Simulation Intelligence Engine v2 + Formation overload (§2, §3). */
export function simulateMatchV2(
  home: SimSquadInput | SimSquadInputV2,
  away: SimSquadInput | SimSquadInputV2,
  seed: string,
  matchday: number,
  options: SimulateMatchOptions = {},
): MatchResultV2 {
  const config: SimMatchConfig = { ...DEFAULT_SIM_CONFIG, ...options.config };
  const rng = createRng(`${seed}:md${matchday}:v2`);

  if (config.simulationMode === "prime_powers") {
    return simulatePrimePowersSync(home, away, seed, matchday);
  }

  const era = resolveEraProfile(
    config.eraContext,
    (home as SimSquadInputV2).draftMode?.decade,
    (away as SimSquadInputV2).draftMode?.decade,
  );
  const weather = resolveWeather(config.weather, rng);
  const formHome = config.formationHomeId ?? (home as SimSquadInputV2).formationId ?? "4-4-2";
  const formAway = config.formationAwayId ?? (away as SimSquadInputV2).formationId ?? "4-4-2";
  const statsFor = options.statsFor ?? (() => []);

  const homeStates = initPlayerStates(home.players, options.carryFatigueHome);
  const awayStates = initPlayerStates(away.players, options.carryFatigueAway);

  const homeMeta = home.players.map((p) => computePlayerMeta(p, statsFor(p.playerId), p.breakdown.awardBonus));
  const awayMeta = away.players.map((p) => computePlayerMeta(p, statsFor(p.playerId), p.breakdown.awardBonus));
  const avgTriHome =
    homeMeta.reduce((s, m) => s + m.technicalRelianceIndex, 0) / Math.max(1, homeMeta.length);
  const avgTriAway =
    awayMeta.reduce((s, m) => s + m.technicalRelianceIndex, 0) / Math.max(1, awayMeta.length);

  const homeAssignments = assignPlayersToFormationSlots(home.players, formHome, getFormation);
  const awayAssignments = assignPlayersToFormationSlots(away.players, formAway, getFormation);

  const effectiveHome = home.players.map((p, i) => {
    const peakEraId = playerPeakEraId(statsFor(p.playerId));
    const terms = computeFitTerms(era, p.attributes, homeMeta[i]!, config.tacticalIdentityHome, peakEraId);
    const slot = homeAssignments.get(p.playerId);
    const roleMod = slot ? roleFitModifier(p, slot) : 0;
    const attrs = effectiveAttributes(p.attributes, terms, 1, 1, 0, roleMod);
    return {
      ...p,
      attributes: attrs,
      ovr: effectiveOvrForPosition(p.ovr, p.attributes, attrs, p.position),
      _anachronism: Math.abs(terms.anachronismTerm),
    };
  });
  const effectiveAway = away.players.map((p, i) => {
    const peakEraId = playerPeakEraId(statsFor(p.playerId));
    const terms = computeFitTerms(era, p.attributes, awayMeta[i]!, config.tacticalIdentityAway, peakEraId);
    const slot = awayAssignments.get(p.playerId);
    const roleMod = slot ? roleFitModifier(p, slot) : 0;
    const attrs = effectiveAttributes(p.attributes, terms, 1, 1, 0, roleMod);
    return {
      ...p,
      attributes: attrs,
      ovr: effectiveOvrForPosition(p.ovr, p.attributes, attrs, p.position),
      _anachronism: Math.abs(terms.anachronismTerm),
    };
  });

  const homeEraFriction =
    effectiveHome.reduce((s, p) => s + ((p as { _anachronism?: number })._anachronism ?? 0), 0) /
    Math.max(1, effectiveHome.length);
  const awayEraFriction =
    effectiveAway.reduce((s, p) => s + ((p as { _anachronism?: number })._anachronism ?? 0), 0) /
    Math.max(1, effectiveAway.length);

  let activeFormHome = formHome;
  let activeFormAway = formAway;
  let homeFormationChanges = 0;
  let awayFormationChanges = 0;

  let momentum = 0;
  let homeGoals = 0;
  let awayGoals = 0;

  const goalRates = computeMatchGoalRates({
    homePlayers: effectiveHome,
    awayPlayers: effectiveAway,
    formationHomeId: formHome,
    formationAwayId: formAway,
    homeAdvantage: config.venue.homeAdvantage,
    era,
    tacticalIdentityHome: config.tacticalIdentityHome,
    tacticalIdentityAway: config.tacticalIdentityAway,
    tacticalAttackBoostHome: tacticalAttackBoost(config.tacticalIdentityHome),
    tacticalAttackBoostAway: tacticalAttackBoost(config.tacticalIdentityAway),
    homeEraFriction,
    awayEraFriction,
  });
  let [targetHomeGoals, targetAwayGoals] = sampleDixonColesScore(
    goalRates.lambda,
    goalRates.mu,
    rng,
    goalRates.rho,
  );
  // Draw break — authentic football clusters around 1-0 / 2-1 / 2-0, not endless 0-0 / 1-1.
  // Hidden xG stays in λ/μ; we only nudge sampled draws when the rates aren't a coin flip.
  const rateGap = Math.abs(goalRates.lambda - goalRates.mu);
  const totalRate = goalRates.lambda + goalRates.mu;
  if (targetHomeGoals === targetAwayGoals) {
    const nilNil = targetHomeGoals === 0;
    const breakP = nilNil
      ? Math.min(0.8, 0.3 + totalRate * 0.12 + rateGap * 0.22)
      : rateGap >= 0.4
        ? Math.min(0.72, 0.24 + rateGap * 0.35)
        : rateGap >= 0.22
          ? 0.2
          : 0;
    if (breakP > 0 && rng() < breakP) {
      [targetHomeGoals, targetAwayGoals] = sampleDixonColesScore(
        goalRates.lambda,
        goalRates.mu,
        rng,
        goalRates.rho,
      );
      if (targetHomeGoals === targetAwayGoals) {
        if (goalRates.lambda >= goalRates.mu) targetHomeGoals += 1;
        else targetAwayGoals += 1;
      }
    }
  }
  const events: ExtendedMatchEvent[] = [];
  const zoneEvents: ZoneOverloadEvent[] = [];
  // Kickoff effective OVRs — same values that drive goal rates (not chance-loop noise).
  const fitAccum = new Map<string, { base: number; eff: number; name: string }>();
  for (const p of home.players) {
    const eff = effectiveHome.find((e) => e.playerId === p.playerId);
    fitAccum.set(p.playerId, { base: p.ovr, eff: eff?.ovr ?? p.ovr, name: p.name });
  }
  for (const p of away.players) {
    const eff = effectiveAway.find((e) => e.playerId === p.playerId);
    fitAccum.set(p.playerId, { base: p.ovr, eff: eff?.ovr ?? p.ovr, name: p.name });
  }

  events.push({
    minute: 0,
    type: "kickoff",
    team: "home",
    text: options.statsFor
      ? seededKickoffCommentary(era.label, home.name ?? "Home", away.name ?? "Away")
      : commentaryForV2("kickoff", undefined, undefined, era.label),
  });

  for (let phase = 0; phase < PHASES; phase++) {
    momentum *= MOMENTUM_DECAY;
    const minute = Math.min(90, Math.floor((phase / PHASES) * 90) + 1);

    if (
      config.allowMidmatchFormationChange &&
      phase === Math.floor(PHASES / 2) &&
      homeGoals <= awayGoals - 2 &&
      homeFormationChanges < 1
    ) {
      activeFormHome = activeFormHome === "4-4-2" ? "4-3-3" : "4-4-2";
      homeFormationChanges++;
      events.push({
        minute,
        type: "momentum_swing",
        team: "home",
        text: `${home.name} switches to ${activeFormHome} — chasing the game.`,
      });
    }
    if (
      config.allowMidmatchFormationChange &&
      phase === Math.floor(PHASES / 2) &&
      awayGoals <= homeGoals - 2 &&
      awayFormationChanges < 1
    ) {
      activeFormAway = activeFormAway === "4-4-2" ? "4-3-3" : "4-4-2";
      awayFormationChanges++;
      events.push({
        minute,
        type: "momentum_swing",
        team: "away",
        text: `${away.name} switches to ${activeFormAway} — chasing the game.`,
      });
    }

    const homeCount = activeCount(homeStates);
    const awayCount = activeCount(awayStates);
    const homeSquad = {
      ...home,
      players: effectiveHome.filter((p) => {
        const st = homeStates.get(p.playerId);
        return st && !st.sentOff && !st.injured;
      }),
    };
    const awaySquad = {
      ...away,
      players: effectiveAway.filter((p) => {
        const st = awayStates.get(p.playerId);
        return st && !st.sentOff && !st.injured;
      }),
    };

    applyFatigueTolls(home, homeStates, homeMeta, era, weather.fatigueMultiplier, rng, events, minute, "home", options.statsFor);
    applyFatigueTolls(away, awayStates, awayMeta, era, weather.fatigueMultiplier, rng, events, minute, "away", options.statsFor);

    const homeStr = squadStrengths(homeSquad.players);
    const awayStr = squadStrengths(awaySquad.players);
    const numAdvHome = homeCount / Math.max(1, awayCount);
    const numAdvAway = awayCount / Math.max(1, homeCount);

    let homePossession =
      rng() <
      sigmoid(
        (homeStr.midfield * numAdvHome - awayStr.midfield * numAdvAway) / 12 +
          (config.venue.homeAdvantage ? 0.15 : 0) +
          momentum / 200,
      );

    const atkIdentity = homePossession ? config.tacticalIdentityHome : config.tacticalIdentityAway;
    const zone = pickPhaseZone(atkIdentity, rng);
    const atkForm = homePossession ? activeFormHome : activeFormAway;
    const defForm = homePossession ? activeFormAway : activeFormHome;
    const zMod = zoneOverloadModifier(atkForm, defForm, zone);
    if (Math.abs(zMod) >= 0.08) {
      const atkName = (homePossession ? home.name : away.name) ?? "Attackers";
      zoneEvents.push({
        minute,
        zone,
        team: homePossession ? "home" : "away",
        overloadDelta: Math.round(zMod * 100) / 100,
        text: overloadCommentary(atkName, zone, zMod, atkForm, defForm),
      });
    }

    const atk = homePossession ? homeStr : awayStr;
    const def = homePossession ? awayStr : homeStr;
    const atkSquad = homePossession ? homeSquad : awaySquad;
    const team = homePossession ? "home" : "away";

    const momBoost = 1 + (homePossession ? momentum : -momentum) / 250;
    const chaos = 1 + (1 - era.tactical_sophistication) * (rng() - 0.5) * 0.4;

    const chanceProb =
      sigmoid((atk.attack * momBoost * chaos - def.defense) / 14) * weather.chanceMultiplier;
    if (rng() > chanceProb * 0.82) continue;

    const shotProb = sigmoid((atk.attack * momBoost - def.gk) / 10);
    const scorer = pickScorer(atkSquad, rng);

    if (rng() > shotProb * 0.62) {
      events.push({
        minute,
        type: "chance_missed",
        team,
        playerName: scorer.name,
        text: eventCommentary("chance_missed", scorer, minute, options.statsFor),
      });
      continue;
    }

    const goalProb = sigmoid((atk.attack * 0.6 + atk.midfield * 0.2 - def.gk) / 11) * (1 + zMod);
    const teamTarget = homePossession ? targetHomeGoals : targetAwayGoals;
    const teamCurrent = homePossession ? homeGoals : awayGoals;
    if (teamCurrent >= teamTarget) {
      events.push({
        minute,
        type: "shot_saved",
        team,
        playerName: scorer.name,
        text: eventCommentary("shot_saved", scorer, minute, options.statsFor),
      });
      continue;
    }
    if (rng() < goalProb * 0.52) {
      if (homePossession) homeGoals++;
      else awayGoals++;
      momentum = homePossession ? momentum + 18 : momentum - 18;
      events.push({
        minute,
        type: "goal",
        team,
        playerName: scorer.name,
        text: eventCommentary("goal", scorer, minute, options.statsFor),
      });
      if (Math.abs(momentum) > 40) {
        events.push({
          minute,
          type: "momentum_swing",
          team,
          text: momentumCommentary(team === "home" ? home.name! : away.name!, momentum),
        });
      }
    } else {
      events.push({
        minute,
        type: "shot_saved",
        team,
        playerName: scorer.name,
        text: eventCommentary("shot_saved", scorer, minute, options.statsFor),
      });
    }

    if (rng() < era.tackling_leniency * 0.008) {
      const cardPlayer = atkSquad.players[Math.floor(rng() * atkSquad.players.length)]!;
      const cardProfile = profileFor(cardPlayer, options.statsFor);
      if (rng() < 0.12) {
        const st = (team === "home" ? homeStates : awayStates).get(cardPlayer.playerId);
        if (st) st.sentOff = true;
        events.push({
          minute,
          type: "card_red",
          team,
          playerName: cardPlayer.name,
          text: cardProfile
            ? seededCardCommentary(cardPlayer.name, minute, cardProfile, true)
            : `${minute}' RED CARD — ${cardPlayer.name} sent off!`,
        });
      } else {
        events.push({
          minute,
          type: "card_yellow",
          team,
          playerName: cardPlayer.name,
          text: cardProfile
            ? seededCardCommentary(cardPlayer.name, minute, cardProfile, false)
            : `${minute}' Yellow card for ${cardPlayer.name}.`,
        });
      }
    }
  }

  injectRemainingGoals(
    homeGoals,
    targetHomeGoals,
    awayGoals,
    targetAwayGoals,
    effectiveHome,
    effectiveAway,
    home.name ?? "Home",
    away.name ?? "Away",
    events,
    rng,
    options.statsFor,
  );
  homeGoals = targetHomeGoals;
  awayGoals = targetAwayGoals;

  events.push({
    minute: 90,
    type: "fulltime",
    team: "home",
    text: options.statsFor
      ? seededFulltimeCommentary(home.name ?? "Home", away.name ?? "Away", homeGoals, awayGoals)
      : commentaryForV2("fulltime"),
  });

  let penaltyShootout: MatchResultV2["penaltyShootout"];
  if (config.isKnockout && homeGoals === awayGoals) {
    const pens = simulatePenaltyShootout(home, away, rng, homeMeta, awayMeta);
    penaltyShootout = pens;
    if (pens.winner === "home") homeGoals++;
    else awayGoals++;
  }

  const fitReport: FitReportLine[] = [];
  for (const [playerId, acc] of fitAccum) {
    const meta = [...homeMeta, ...awayMeta].find((m) => m.playerId === playerId);
    if (!meta) continue;
    // Bound era deltas so fit is expressive without absurd −40 collapses.
    const rawDelta = acc.eff - acc.base;
    const clampedEff = acc.base + Math.max(-12, Math.min(12, rawDelta));
    const { delta, summary, tags } = buildFitSummary(acc.base, clampedEff, era, meta);
    fitReport.push({
      playerId,
      playerName: acc.name,
      baseOvr: acc.base,
      effectiveDelta: delta,
      summary,
      tags,
    });
    if (Math.abs(delta) >= 5) {
      events.push({
        minute: 90,
        type: "fit_commentary",
        team: "home",
        playerName: acc.name,
        text: fitCommentary(acc.name, delta),
      });
    }
  }

  return {
    homeGoals,
    awayGoals,
    homeName: home.name ?? "Your XI",
    awayName: away.name ?? "Opponent",
    events,
    mvpPlayerId: pickMvp(home, away, homeGoals, awayGoals, rng),
    fitReport: fitReport.sort((a, b) => b.effectiveDelta - a.effectiveDelta),
    zoneOverloadEvents: zoneEvents,
    momentumFinal: Math.round(momentum),
    eraProfileId: era.id,
    simulationMode: config.simulationMode,
    preMatchHeadline: tacticalPreviewHeadline(home.name ?? "Home", away.name ?? "Away", avgTriHome, avgTriAway),
    penaltyShootout,
    goalRateModel: {
      lambda: Math.round(goalRates.lambda * 1000) / 1000,
      mu: Math.round(goalRates.mu * 1000) / 1000,
      rho: goalRates.rho,
      targetHomeGoals,
      targetAwayGoals,
    },
  };
}

function injectRemainingGoals(
  homeGoals: number,
  targetHome: number,
  awayGoals: number,
  targetAway: number,
  homePlayers: SimSquadInput["players"],
  awayPlayers: SimSquadInput["players"],
  homeName: string,
  awayName: string,
  events: ExtendedMatchEvent[],
  rng: Rng,
  statsFor?: (playerId: string) => import("@sportverse/sports-db").PlayerSeasonStat[],
): void {
  let h = homeGoals;
  let a = awayGoals;
  const homeSquad = { name: homeName, playerIds: [], players: homePlayers, squadOvr: 0 };
  const awaySquad = { name: awayName, playerIds: [], players: awayPlayers, squadOvr: 0 };

  while (h < targetHome) {
    h++;
    const scorer = pickScorer(homeSquad, rng);
    const minute = 88 + Math.floor(rng() * 2);
    events.push({
      minute,
      type: "goal",
      team: "home",
      playerName: scorer.name,
      text: eventCommentary("goal", scorer, minute, statsFor),
    });
  }
  while (a < targetAway) {
    a++;
    const scorer = pickScorer(awaySquad, rng);
    const minute = 88 + Math.floor(rng() * 2);
    events.push({
      minute,
      type: "goal",
      team: "away",
      playerName: scorer.name,
      text: eventCommentary("goal", scorer, minute, statsFor),
    });
  }
}

function applyFatigueTolls(
  squad: SimSquadInput,
  states: Map<string, PlayerSimState>,
  metaList: ReturnType<typeof computePlayerMeta> extends infer T ? T[] : never,
  era: ReturnType<typeof resolveEraProfile>,
  weatherMult: number,
  rng: Rng,
  events: ExtendedMatchEvent[],
  minute: number,
  team: "home" | "away",
  statsFor?: (playerId: string) => import("@sportverse/sports-db").PlayerSeasonStat[],
) {
  for (const p of squad.players) {
    const st = states.get(p.playerId);
    const meta = metaList.find((m) => m.playerId === p.playerId);
    if (!st || !meta || st.sentOff || st.injured) continue;
    const prob = fatigueTollProbability(era, meta, weatherMult);
    if (rng() > prob) continue;
    if (rng() < 0.15) {
      st.injured = true;
      st.carryFatigue += 2;
      const profile = profileFor(p, statsFor);
      events.push({
        minute,
        type: "substitution",
        team,
        playerName: p.name,
        text: profile
          ? seededInjuryCommentary(p.name, minute, profile)
          : `${minute}' ${p.name} forced off — injury in heavy conditions.`,
      });
    } else {
      st.fatigueMultiplier = Math.max(0.75, st.fatigueMultiplier - 0.05 - rng() * 0.1);
      st.carryFatigue += 1;
      if (rng() < 0.08) {
        const profile = profileFor(p, statsFor);
        events.push({
          minute,
          type: "fit_commentary",
          team,
          playerName: p.name,
          text: profile
            ? seededFatigueCommentary(p.name, minute, profile)
            : `${p.name} is starting to feel the pace of this one.`,
        });
      }
    }
  }
}

function pickMvp(
  home: SimSquadInput,
  away: SimSquadInput,
  hg: number,
  ag: number,
  rng: Rng,
): string | undefined {
  const wonHome = hg > ag;
  const squad = wonHome || hg === ag ? home : away;
  if (!squad.players.length) return undefined;
  const sorted = [...squad.players].sort((a, b) => b.ovr - a.ovr);
  return sorted[Math.floor(rng() * Math.min(3, sorted.length))]?.playerId;
}

import { simulateMatchLegacy } from "./match-legacy.js";

function simulatePrimePowersSync(
  home: SimSquadInput,
  away: SimSquadInput,
  seed: string,
  matchday: number,
): MatchResultV2 {
  const legacy = simulateMatchLegacy(home, away, seed, matchday);
  return {
    ...legacy,
    fitReport: [],
    zoneOverloadEvents: [],
    momentumFinal: 0,
    eraProfileId: "prime-powers",
    simulationMode: "prime_powers",
    events: legacy.events.map((e) => ({ ...e, type: e.type as ExtendedMatchEvent["type"] })),
  };
}

export function extractCarryFatigue(states: Map<string, PlayerSimState>): Map<string, number> {
  const out = new Map<string, number>();
  for (const [id, st] of states) out.set(id, st.carryFatigue);
  return out;
}
