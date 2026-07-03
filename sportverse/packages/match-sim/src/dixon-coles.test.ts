import { describe, expect, it } from "vitest";
import {
  buildScoreDistribution,
  computeDixonColesRates,
  dixonColesTau,
  jointProbability,
  poissonPmf,
  sampleDixonColesScore,
} from "./dixon-coles.js";
import { createRng } from "./rng.js";

describe("Dixon–Coles — low-score correction (§2.2)", () => {
  it("tau matches documented formulas at (0,0)", () => {
    const lambda = 1.2;
    const mu = 1.0;
    const rho = -0.13;
    expect(dixonColesTau(0, 0, lambda, mu, rho)).toBeCloseTo(1 - lambda * mu * rho, 10);
    expect(dixonColesTau(0, 1, lambda, mu, rho)).toBeCloseTo(1 + lambda * rho, 10);
    expect(dixonColesTau(1, 0, lambda, mu, rho)).toBeCloseTo(1 + mu * rho, 10);
    expect(dixonColesTau(1, 1, lambda, mu, rho)).toBeCloseTo(1 - rho, 10);
    expect(dixonColesTau(2, 1, lambda, mu, rho)).toBe(1);
  });

  it("score distribution sums to 1", () => {
    const dist = buildScoreDistribution(1.35, 1.1, -0.13, 6);
    const total = dist.reduce((s, c) => s + c.prob, 0);
    expect(total).toBeCloseTo(1, 6);
  });

  it("negative rho increases mass on low draws vs independent Poisson", () => {
    const lambda = 1.1;
    const mu = 1.0;
    const rho = -0.13;
    const dc00 = jointProbability(0, 0, lambda, mu, rho);
    const indep00 = poissonPmf(0, lambda) * poissonPmf(0, mu);
    expect(dc00).toBeGreaterThan(indep00);
  });
});

describe("Dixon–Coles — log-linear rates (§2.1)", () => {
  it("home advantage increases lambda not mu", () => {
    const withHome = computeDixonColesRates(0.1, 0, 0.1, 0, { homeAdvantage: true, gamma: 0.25 });
    const neutral = computeDixonColesRates(0.1, 0, 0.1, 0, { homeAdvantage: false, gamma: 0.25 });
    expect(withHome.lambda).toBeGreaterThan(neutral.lambda);
    expect(withHome.mu).toBeCloseTo(neutral.mu, 10);
  });

  it("sampled scores are non-negative integers", () => {
    const rng = createRng("dc-sample-test");
    const rates = computeDixonColesRates(0.05, 0.02, -0.02, 0.04);
    for (let i = 0; i < 50; i++) {
      const [h, a] = sampleDixonColesScore(rates.lambda, rates.mu, rng, rates.rho);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(h)).toBe(true);
      expect(Number.isInteger(a)).toBe(true);
    }
  });
});
