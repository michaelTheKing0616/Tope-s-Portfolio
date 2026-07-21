import type { PlayerAttributes, Position } from "@sportverse/draftballer-types";
import type { SubMetricVector } from "./sub-metrics.js";
import {
  minutesReliabilityFactor,
  positionMetricPercentile,
  positionMetricPercentileInverted,
  shrinkPercentileTowardNeutral,
  type PercentileMetricKey,
} from "./position-percentiles.js";

/** Four-pillar model aligned with analytics departments — adapted to box-score inputs. */
export type PillarKey =
  | "finishing"
  | "chance_creation"
  | "progression"
  | "defending"
  | "availability"
  | "discipline";

export type PillarScores = Record<PillarKey, number>;

/** Approved pillar weights by role (sum to 1.0). */
export const POSITION_PILLAR_WEIGHTS: Record<Position, Partial<Record<PillarKey, number>>> = {
  ST: { finishing: 0.45, chance_creation: 0.2, progression: 0.15, defending: 0.05, availability: 0.1, discipline: 0.05 },
  W: { finishing: 0.25, chance_creation: 0.3, progression: 0.3, defending: 0.05, availability: 0.07, discipline: 0.03 },
  AM: { finishing: 0.2, chance_creation: 0.45, progression: 0.2, defending: 0.05, availability: 0.07, discipline: 0.03 },
  CM: { finishing: 0.1, chance_creation: 0.2, progression: 0.3, defending: 0.25, availability: 0.1, discipline: 0.05 },
  DM: { finishing: 0.05, chance_creation: 0.15, progression: 0.35, defending: 0.35, availability: 0.07, discipline: 0.03 },
  FB: { finishing: 0.08, chance_creation: 0.22, progression: 0.25, defending: 0.35, availability: 0.07, discipline: 0.03 },
  CB: { finishing: 0.05, chance_creation: 0.1, progression: 0.25, defending: 0.5, availability: 0.07, discipline: 0.03 },
  GK: { defending: 0.5, progression: 0.2, availability: 0.2, discipline: 0.1 },
};

/** Map sub-metric keys → pillar with within-pillar weight. */
const SUBMETRIC_PILLAR_MAP: Partial<
  Record<keyof SubMetricVector & string, { pillar: PillarKey; weight: number }>
> = {
  goals_per_90: { pillar: "finishing", weight: 0.35 },
  npxg_per_90: { pillar: "finishing", weight: 0.4 },
  conversion_rate: { pillar: "finishing", weight: 0.25 },
  assists_per_90: { pillar: "chance_creation", weight: 0.4 },
  pass_volume: { pillar: "chance_creation", weight: 0.3 },
  set_piece_proxy: { pillar: "chance_creation", weight: 0.15 },
  progressive_pass_proxy: { pillar: "progression", weight: 0.45 },
  progressive_carry_proxy: { pillar: "progression", weight: 0.35 },
  dribble_proxy: { pillar: "progression", weight: 0.2 },
  def_actions_proxy: { pillar: "defending", weight: 0.3 },
  defensive_value_proxy: { pillar: "defending", weight: 0.35 },
  aerial_proxy: { pillar: "defending", weight: 0.2 },
  clean_sheet_proxy: { pillar: "defending", weight: 0.15 },
  saves_proxy: { pillar: "defending", weight: 0.25 },
  minutes_per_app: { pillar: "availability", weight: 0.6 },
  availability_rate: { pillar: "availability", weight: 0.4 },
  discipline_proxy: { pillar: "discipline", weight: 1 },
};

function unitToPercentile(unit: number): number {
  return Math.max(0, Math.min(100, unit * 100));
}

/** Build pillar scores (0–100) from normalized sub-metrics. */
export function pillarScoresFromSubMetrics(
  position: Position,
  subMetrics: SubMetricVector,
): PillarScores {
  const accum: Partial<Record<PillarKey, { sum: number; weight: number }>> = {};

  for (const [key, unit] of Object.entries(subMetrics) as [keyof SubMetricVector, number][]) {
    const mapping = SUBMETRIC_PILLAR_MAP[key as string];
    if (!mapping || unit == null) continue;
    const bucket = accum[mapping.pillar] ?? { sum: 0, weight: 0 };
    bucket.sum += unitToPercentile(unit) * mapping.weight;
    bucket.weight += mapping.weight;
    accum[mapping.pillar] = bucket;
  }

  const scores = {} as PillarScores;
  for (const pillar of Object.keys(POSITION_PILLAR_WEIGHTS.ST) as PillarKey[]) {
    const bucket = accum[pillar];
    scores[pillar] = bucket && bucket.weight > 0 ? bucket.sum / bucket.weight : 50;
  }
  if (position === "GK") {
    scores.defending = Math.max(
      scores.defending,
      unitToPercentile(subMetrics.saves_proxy ?? 0.45) * 0.5 +
        unitToPercentile(subMetrics.clean_sheet_proxy ?? 0.45) * 0.5,
    );
  }
  return scores;
}

/** Hybrid full-back: MAX(defensive FB profile, attacking FB profile) — not forced into one archetype. */
function hybridFullbackOvr(pillars: PillarScores): number {
  const defensiveProfile =
    pillars.defending * 0.65 + pillars.progression * 0.35;
  const attackingProfile =
    (pillars.progression * 0.3 + pillars.chance_creation * 0.25 + pillars.finishing * 0.25) +
    pillars.defending * 0.2;
  return Math.max(defensiveProfile, attackingProfile);
}

/** Weighted pillar sum → 1–99 OVR with minutes shrinkage. */
export function ovrFromPillarScores(
  position: Position,
  pillars: PillarScores,
  minutes: number,
  apps: number,
): number {
  const reliability = minutesReliabilityFactor(minutes, apps);
  const weights = POSITION_PILLAR_WEIGHTS[position];

  let raw: number;
  if (position === "FB") {
    raw = hybridFullbackOvr(pillars);
  } else {
    let sum = 0;
    let wSum = 0;
    for (const [pillar, w] of Object.entries(weights) as [PillarKey, number][]) {
      if (!w) continue;
      const shrunk = shrinkPercentileTowardNeutral(pillars[pillar] ?? 50, reliability);
      sum += shrunk * w;
      wSum += w;
    }
    raw = wSum > 0 ? sum / wSum : 50;
  }

  const shrunkRaw = position === "FB" ? shrinkPercentileTowardNeutral(raw, reliability) : raw;
  return Math.max(1, Math.min(99, Math.round(40 + (shrunkRaw / 100) * 58)));
}

/** Map pillar scores to 6 face attributes for card display. */
export function attrsFromPillarScores(position: Position, pillars: PillarScores): PlayerAttributes {
  const clamp = (n: number) => Math.max(1, Math.min(99, Math.round(n)));
  const pct = (p: number) => clamp(40 + (p / 100) * 58);

  return {
    sho: pct(pillars.finishing * 0.85 + pillars.chance_creation * 0.15),
    pas: pct(pillars.chance_creation * 0.55 + pillars.progression * 0.45),
    dri: pct(pillars.progression * 0.6 + pillars.finishing * 0.2 + pillars.chance_creation * 0.2),
    pac: pct(pillars.progression * 0.45 + pillars.availability * 0.35 + pillars.finishing * 0.2),
    def: pct(pillars.defending * 0.85 + pillars.discipline * 0.15),
    phy: pct(pillars.availability * 0.5 + pillars.defending * 0.35 + pillars.discipline * 0.15),
  };
}

/** Direct percentile inputs from raw per-90 rates (bypasses proxy layer when available). */
export function rawRatesToPercentileVector(
  position: Position,
  rates: Partial<Record<PercentileMetricKey, number>>,
  minutes: number,
  apps: number,
): PillarScores {
  const reliability = minutesReliabilityFactor(minutes, apps);
  const pct = (metric: PercentileMetricKey, value: number, invert = false) => {
    const raw = invert
      ? positionMetricPercentileInverted(position, metric, value)
      : positionMetricPercentile(position, metric, value);
    return shrinkPercentileTowardNeutral(raw, reliability);
  };

  const finishing = rates.npxg_per_90 != null
    ? pct("npxg_per_90", rates.npxg_per_90) * 0.6 + pct("goals_per_90", rates.goals_per_90 ?? rates.npxg_per_90) * 0.4
    : rates.goals_per_90 != null
      ? pct("goals_per_90", rates.goals_per_90)
      : 50;

  return {
    finishing,
    chance_creation: rates.assists_per_90 != null ? pct("assists_per_90", rates.assists_per_90) : 50,
    progression:
      rates.goal_involvement_per_90 != null
        ? pct("goal_involvement_per_90", rates.goal_involvement_per_90)
        : 50,
    defending:
      rates.goals_conceded_per_90 != null
        ? pct("goals_conceded_per_90", rates.goals_conceded_per_90, true) * 0.55 +
          (rates.clean_sheet_rate != null ? pct("clean_sheet_rate", rates.clean_sheet_rate) * 0.45 : 22.5)
        : rates.clean_sheet_rate != null
          ? pct("clean_sheet_rate", rates.clean_sheet_rate)
          : 50,
    availability: rates.minutes_per_app != null ? pct("minutes_per_app", rates.minutes_per_app) : 50,
    discipline: rates.discipline_per_90 != null ? pct("discipline_per_90", rates.discipline_per_90, true) : 50,
  };
}
