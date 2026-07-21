import type { Position } from "@sportverse/draftballer-types";

/** Empirical breakpoint table — p10/p25/p50/p75/p90 per position × metric (per-90 or rate). */
export interface PercentileReference {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export type PercentileMetricKey =
  | "npxg_per_90"
  | "goals_per_90"
  | "assists_per_90"
  | "goal_involvement_per_90"
  | "minutes_per_app"
  | "clean_sheet_rate"
  | "goals_conceded_per_90"
  | "discipline_per_90"
  | "availability_rate";

/**
 * Position-conditioned reference distributions.
 * Derived from football analytics priors + archive aggregates; replace via
 * scripts/etl/build-position-percentiles.mjs for empirical fit.
 */
export const POSITION_PERCENTILE_REFERENCES: Partial<
  Record<Position, Partial<Record<PercentileMetricKey, PercentileReference>>>
> = {
  ST: {
    npxg_per_90: { p10: 0.08, p25: 0.18, p50: 0.35, p75: 0.55, p90: 0.78 },
    goals_per_90: { p10: 0.08, p25: 0.2, p50: 0.38, p75: 0.58, p90: 0.82 },
    assists_per_90: { p10: 0.02, p25: 0.05, p50: 0.1, p75: 0.18, p90: 0.28 },
    goal_involvement_per_90: { p10: 0.15, p25: 0.3, p50: 0.48, p75: 0.7, p90: 0.95 },
    minutes_per_app: { p10: 55, p25: 65, p50: 78, p75: 85, p90: 88 },
  },
  W: {
    npxg_per_90: { p10: 0.05, p25: 0.12, p50: 0.22, p75: 0.38, p90: 0.55 },
    goals_per_90: { p10: 0.05, p25: 0.12, p50: 0.24, p75: 0.4, p90: 0.58 },
    assists_per_90: { p10: 0.04, p25: 0.1, p50: 0.2, p75: 0.32, p90: 0.45 },
    goal_involvement_per_90: { p10: 0.12, p25: 0.25, p50: 0.42, p75: 0.62, p90: 0.85 },
    minutes_per_app: { p10: 58, p25: 68, p50: 80, p75: 86, p90: 89 },
  },
  AM: {
    npxg_per_90: { p10: 0.04, p25: 0.1, p50: 0.18, p75: 0.3, p90: 0.45 },
    goals_per_90: { p10: 0.04, p25: 0.1, p50: 0.2, p75: 0.32, p90: 0.48 },
    assists_per_90: { p10: 0.06, p25: 0.12, p50: 0.22, p75: 0.35, p90: 0.48 },
    goal_involvement_per_90: { p10: 0.15, p25: 0.28, p50: 0.45, p75: 0.62, p90: 0.82 },
    minutes_per_app: { p10: 60, p25: 72, p50: 82, p75: 87, p90: 90 },
  },
  CM: {
    npxg_per_90: { p10: 0.02, p25: 0.05, p50: 0.1, p75: 0.18, p90: 0.28 },
    goals_per_90: { p10: 0.02, p25: 0.05, p50: 0.1, p75: 0.18, p90: 0.28 },
    assists_per_90: { p10: 0.03, p25: 0.06, p50: 0.12, p75: 0.2, p90: 0.3 },
    goal_involvement_per_90: { p10: 0.08, p25: 0.15, p50: 0.25, p75: 0.38, p90: 0.52 },
    minutes_per_app: { p10: 62, p25: 75, p50: 84, p75: 88, p90: 91 },
    goals_conceded_per_90: { p10: 0.8, p25: 1.0, p50: 1.25, p75: 1.5, p90: 1.8 },
  },
  DM: {
    npxg_per_90: { p10: 0.01, p25: 0.03, p50: 0.06, p75: 0.12, p90: 0.2 },
    goals_per_90: { p10: 0.01, p25: 0.03, p50: 0.06, p75: 0.12, p90: 0.2 },
    assists_per_90: { p10: 0.02, p25: 0.04, p50: 0.08, p75: 0.14, p90: 0.22 },
    goal_involvement_per_90: { p10: 0.05, p25: 0.1, p50: 0.16, p75: 0.26, p90: 0.38 },
    minutes_per_app: { p10: 65, p25: 78, p50: 86, p75: 89, p90: 92 },
    goals_conceded_per_90: { p10: 0.75, p25: 0.95, p50: 1.15, p75: 1.4, p90: 1.7 },
  },
  FB: {
    npxg_per_90: { p10: 0.01, p25: 0.03, p50: 0.06, p75: 0.1, p90: 0.16 },
    goals_per_90: { p10: 0.01, p25: 0.03, p50: 0.06, p75: 0.1, p90: 0.16 },
    assists_per_90: { p10: 0.03, p25: 0.06, p50: 0.12, p75: 0.2, p90: 0.3 },
    goal_involvement_per_90: { p10: 0.06, p25: 0.12, p50: 0.2, p75: 0.32, p90: 0.45 },
    minutes_per_app: { p10: 68, p25: 80, p50: 88, p75: 91, p90: 93 },
    goals_conceded_per_90: { p10: 0.85, p25: 1.05, p50: 1.3, p75: 1.55, p90: 1.85 },
  },
  CB: {
    npxg_per_90: { p10: 0.01, p25: 0.02, p50: 0.04, p75: 0.08, p90: 0.14 },
    goals_per_90: { p10: 0.01, p25: 0.02, p50: 0.04, p75: 0.08, p90: 0.14 },
    assists_per_90: { p10: 0.01, p25: 0.02, p50: 0.04, p75: 0.08, p90: 0.12 },
    goal_involvement_per_90: { p10: 0.03, p25: 0.06, p50: 0.1, p75: 0.16, p90: 0.24 },
    minutes_per_app: { p10: 70, p25: 82, p50: 89, p75: 92, p90: 94 },
    clean_sheet_rate: { p10: 0.12, p25: 0.22, p50: 0.32, p75: 0.42, p90: 0.52 },
    goals_conceded_per_90: { p10: 0.7, p25: 0.9, p50: 1.1, p75: 1.35, p90: 1.65 },
  },
  GK: {
    clean_sheet_rate: { p10: 0.15, p25: 0.25, p50: 0.35, p75: 0.45, p90: 0.55 },
    goals_conceded_per_90: { p10: 0.7, p25: 0.9, p50: 1.1, p75: 1.35, p90: 1.65 },
    minutes_per_app: { p10: 85, p25: 88, p50: 90, p75: 92, p90: 94 },
  },
};

let loadedReferences: typeof POSITION_PERCENTILE_REFERENCES | null = null;

export function setPositionPercentileReferences(
  refs: typeof POSITION_PERCENTILE_REFERENCES,
): void {
  loadedReferences = refs;
}

function references(): typeof POSITION_PERCENTILE_REFERENCES {
  return loadedReferences ?? POSITION_PERCENTILE_REFERENCES;
}

/** Piecewise-linear percentile (0–100) from empirical breakpoints. */
export function valueToPercentile(value: number, ref: PercentileReference): number {
  const anchors: Array<[number, number]> = [
    [ref.p10, 10],
    [ref.p25, 25],
    [ref.p50, 50],
    [ref.p75, 75],
    [ref.p90, 90],
  ];

  if (value <= anchors[0][0]) {
    const span = Math.max(anchors[0][0] * 0.5, 0.001);
    return Math.max(0, 10 * (value / span));
  }
  if (value >= anchors[anchors.length - 1][0]) {
    const top = anchors[anchors.length - 1][0];
    const span = Math.max(top * 0.35, 0.001);
    return Math.min(100, 90 + 10 * ((value - top) / span));
  }

  for (let i = 0; i < anchors.length - 1; i++) {
    const [v0, p0] = anchors[i];
    const [v1, p1] = anchors[i + 1];
    if (value >= v0 && value <= v1) {
      const t = (value - v0) / Math.max(v1 - v0, 0.0001);
      return p0 + t * (p1 - p0);
    }
  }
  return 50;
}

export function positionMetricPercentile(
  position: Position,
  metric: PercentileMetricKey,
  value: number,
): number {
  const ref = references()[position]?.[metric];
  if (!ref) return 50;
  return valueToPercentile(value, ref);
}

/** Inverted percentile for "lower is better" metrics (conceded, cards). */
export function positionMetricPercentileInverted(
  position: Position,
  metric: PercentileMetricKey,
  value: number,
): number {
  return 100 - positionMetricPercentile(position, metric, value);
}

/**
 * Sample-size reliability — approaches 1.0 above ~1,800–2,000 league minutes.
 * Small samples shrink toward neutral (50th percentile).
 */
export function minutesReliabilityFactor(minutes: number, apps: number): number {
  const effective = Math.min(minutes, apps * 90);
  return 0.5 + 0.5 * (1 - Math.exp(-effective / 1400));
}

export function shrinkPercentileTowardNeutral(percentile: number, factor: number): number {
  return 50 + (percentile - 50) * factor;
}
