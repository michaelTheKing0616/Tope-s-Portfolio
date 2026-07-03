/**
 * Dixon–Coles bivariate Poisson goal model (Dixon & Coles, 1997).
 * Layer 1 statistical backbone for match simulation — Real-World Grounded Engine v4 §2.
 */

import type { Rng } from "./rng.js";

/** UNCALIBRATED — EXPERT PRIOR: typical fitted low-score correlation (small negative). */
export const DEFAULT_RHO = -0.13;

/** UNCALIBRATED — EXPERT PRIOR: log home-advantage intercept γ. */
export const DEFAULT_HOME_GAMMA = 0.25;

export function poissonPmf(k: number, lambda: number): number {
  if (k < 0 || lambda <= 0) return k === 0 && lambda <= 0 ? 1 : 0;
  let logFact = 0;
  for (let i = 2; i <= k; i++) logFact += Math.log(i);
  return Math.exp(k * Math.log(lambda) - lambda - logFact);
}

/**
 * Low-score correction τ_ρ(x,y) — unity outside {0,0},{0,1},{1,0},{1,1}.
 */
export function dixonColesTau(x: number, y: number, lambda: number, mu: number, rho: number): number {
  if (x === 0 && y === 0) return 1 - lambda * mu * rho;
  if (x === 0 && y === 1) return 1 + lambda * rho;
  if (x === 1 && y === 0) return 1 + mu * rho;
  if (x === 1 && y === 1) return 1 - rho;
  return 1;
}

export function jointProbability(
  x: number,
  y: number,
  lambda: number,
  mu: number,
  rho = DEFAULT_RHO,
): number {
  return dixonColesTau(x, y, lambda, mu, rho) * poissonPmf(x, lambda) * poissonPmf(y, mu);
}

export interface DixonColesRates {
  lambda: number;
  mu: number;
  rho: number;
  gamma: number;
  alphaHome: number;
  betaAway: number;
  alphaAway: number;
  betaHome: number;
}

/** Log-linear Dixon–Coles rate model (§2.1). */
export function computeDixonColesRates(
  alphaHome: number,
  betaAway: number,
  alphaAway: number,
  betaHome: number,
  options: { homeAdvantage?: boolean; gamma?: number; rho?: number; gpgScale?: number } = {},
): DixonColesRates {
  const gamma = options.gamma ?? DEFAULT_HOME_GAMMA;
  const rho = options.rho ?? DEFAULT_RHO;
  const gpgScale = options.gpgScale ?? 1;
  const homeAdv = options.homeAdvantage !== false ? gamma : 0;

  const lambda = Math.exp(homeAdv + alphaHome + betaAway) * gpgScale;
  const mu = Math.exp(alphaAway + betaHome) * gpgScale;

  return {
    lambda: Math.max(0.05, Math.min(5, lambda)),
    mu: Math.max(0.05, Math.min(5, mu)),
    rho,
    gamma,
    alphaHome,
    betaAway,
    alphaAway,
    betaHome,
  };
}

/** Build normalized score distribution up to maxGoals (inclusive). */
export function buildScoreDistribution(
  lambda: number,
  mu: number,
  rho = DEFAULT_RHO,
  maxGoals = 8,
): { home: number; away: number; prob: number }[] {
  const cells: { home: number; away: number; prob: number }[] = [];
  let total = 0;
  for (let x = 0; x <= maxGoals; x++) {
    for (let y = 0; y <= maxGoals; y++) {
      const prob = jointProbability(x, y, lambda, mu, rho);
      cells.push({ home: x, away: y, prob });
      total += prob;
    }
  }
  return cells.map((c) => ({ ...c, prob: c.prob / total }));
}

/** Sample final score from Dixon–Coles joint distribution. */
export function sampleDixonColesScore(
  lambda: number,
  mu: number,
  rng: Rng,
  rho = DEFAULT_RHO,
  maxGoals = 8,
): [number, number] {
  const dist = buildScoreDistribution(lambda, mu, rho, maxGoals);
  let roll = rng();
  for (const cell of dist) {
    roll -= cell.prob;
    if (roll <= 0) return [cell.home, cell.away];
  }
  return [dist[dist.length - 1]!.home, dist[dist.length - 1]!.away];
}

/** Exponential time-decay weight φ(t) = exp(-ξt) for recency (§2.3). */
export function dixonColesTimeDecayWeight(ageDays: number, xi: number): number {
  return Math.exp(-xi * Math.max(0, ageDays));
}
