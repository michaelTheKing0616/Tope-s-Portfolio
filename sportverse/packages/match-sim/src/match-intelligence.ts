/**
 * Match Intelligence Engine — replaces plain Dixon–Coles α/β log-linear rates
 * with a feature-rich non-linear model of how matches actually unfold.
 *
 * Features: quality gap, era gpg, style clash, tempo, home, tactics, era friction.
 * Score sampling still uses bivariate Poisson + low-score τ for realism.
 */

import type { EraProfile, RatedPlayerCard, TacticalIdentity } from "@sportverse/draftballer-types";
import { getBridgeCoefficients } from "./aggregation-bridge.js";
import {
  computeDixonColesRates,
  DEFAULT_RHO,
  type DixonColesRates,
} from "./dixon-coles.js";
import { squadStrengthSignals } from "./team-strength.js";

/** Modern top-flight anchor — target ~2.6–3.0 total goals / match. */
const BASELINE_GOALS_PER_GAME = 2.85;

export function eraGoalsPerGameScale(era?: EraProfile): number {
  if (!era) return 1;
  const anchor =
    era.goals_per_game ?? 0.72 * BASELINE_GOALS_PER_GAME + era.tempo * 1.4;
  return anchor / BASELINE_GOALS_PER_GAME;
}

/** Soft per-side floor — kept low so floors don't equalize λ and μ into draws. */
export function squadGoalRateFloor(avgOvr: number): number {
  return 0.3 + Math.max(0, avgOvr - 50) * 0.012;
}

export interface MatchIntelligenceInput {
  homePlayers: RatedPlayerCard[];
  awayPlayers: RatedPlayerCard[];
  formationHomeId: string;
  formationAwayId: string;
  homeAdvantage?: boolean;
  era?: EraProfile;
  tacticalIdentityHome?: TacticalIdentity;
  tacticalIdentityAway?: TacticalIdentity;
  tacticalAttackBoostHome?: number;
  tacticalAttackBoostAway?: number;
  /** Average |anachronism| / style mismatch on home XI (0–1). */
  homeEraFriction?: number;
  awayEraFriction?: number;
}

/** Softplus kept for optional future non-linear stacks. */
export function softplus(x: number): number {
  if (x > 20) return x;
  return Math.log1p(Math.exp(x));
}

function squadAvgOvr(players: RatedPlayerCard[]): number {
  if (!players.length) return 65;
  return players.reduce((s, p) => s + p.ovr, 0) / players.length;
}

/**
 * Style clash: possession vs route_one in high-tempo eras, etc.
 * Returns additive log-rate bias for the attacking side (−0.12…+0.12).
 */
export function styleClashBias(
  attackIdentity: TacticalIdentity,
  defendIdentity: TacticalIdentity,
  era?: EraProfile,
): number {
  const tempo = era?.tempo ?? 0.7;
  const soph = era?.tactical_sophistication ?? 0.7;
  let bias = 0;

  if (attackIdentity === "high_press" && tempo >= 0.7) bias += 0.06;
  if (attackIdentity === "high_press" && tempo < 0.45) bias -= 0.05;
  if (attackIdentity === "possession" && soph >= 0.75) bias += 0.05;
  if (attackIdentity === "possession" && era && era.physicality_intensity >= 0.8) bias -= 0.06;
  if (attackIdentity === "route_one" && era && era.pitch_ball_quality < 0.55) bias += 0.05;
  if (attackIdentity === "counter" && defendIdentity === "high_press") bias += 0.04;
  if (attackIdentity === "possession" && defendIdentity === "high_press") bias -= 0.03;

  return Math.max(-0.12, Math.min(0.12, bias));
}

/**
 * Primary goal-rate model — Dixon–Coles backbone + intelligence modifiers
 * (style clash, era friction, OVR quality tilt). Sampling stays Poisson+τ.
 */
export function computeIntelligentMatchRates(input: MatchIntelligenceInput): DixonColesRates {
  const bridge = getBridgeCoefficients();
  const homeSig = squadStrengthSignals(input.homePlayers, input.formationHomeId, bridge);
  const awaySig = squadStrengthSignals(input.awayPlayers, input.formationAwayId, bridge);

  const gpg = eraGoalsPerGameScale(input.era);
  const homeFriction = input.homeEraFriction ?? 0;
  const awayFriction = input.awayEraFriction ?? 0;

  const homeId = input.tacticalIdentityHome ?? "balanced";
  const awayId = input.tacticalIdentityAway ?? "balanced";
  const homeStyle = styleClashBias(homeId, awayId, input.era);
  const awayStyle = styleClashBias(awayId, homeId, input.era);

  const homeOvr = squadAvgOvr(input.homePlayers);
  const awayOvr = squadAvgOvr(input.awayPlayers);
  // Stronger quality tilt — OVR gaps must separate λ/μ enough for decisive scorelines.
  const qualityTiltHome = ((homeOvr - awayOvr) / 20) * 0.26;
  const qualityTiltAway = ((awayOvr - homeOvr) / 20) * 0.26;

  const alphaHome =
    homeSig.alpha +
    (input.tacticalAttackBoostHome ?? 0) +
    homeStyle +
    qualityTiltHome -
    homeFriction * 0.35;
  const alphaAway =
    awaySig.alpha +
    (input.tacticalAttackBoostAway ?? 0) +
    awayStyle +
    qualityTiltAway -
    awayFriction * 0.35;

  const betaAway = awaySig.beta + awayFriction * 0.15;
  const betaHome = homeSig.beta + homeFriction * 0.15;

  const rates = computeDixonColesRates(alphaHome, betaAway, alphaAway, betaHome, {
    homeAdvantage: input.homeAdvantage !== false,
    gpgScale: gpg,
    rho: DEFAULT_RHO,
  });

  const rawGap = rates.lambda - rates.mu;
  let lambda = Math.max(rates.lambda, squadGoalRateFloor(homeOvr));
  let mu = Math.max(rates.mu, squadGoalRateFloor(awayOvr));
  // Soft floors must not erase quality gaps (main draw-compression failure mode).
  const flooredGap = lambda - mu;
  if (Math.abs(rawGap) > 0.18 && Math.abs(flooredGap) < Math.abs(rawGap) * 0.5) {
    const restored = rawGap * 0.75;
    if (restored >= 0) lambda = Math.max(lambda, mu + restored);
    else mu = Math.max(mu, lambda - restored);
  }
  return { ...rates, lambda, mu };
}
