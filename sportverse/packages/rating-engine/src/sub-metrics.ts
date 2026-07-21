import type { PlayerSeasonStat } from "@sportverse/sports-db";
import type { DraftModeConfig, Position } from "@sportverse/draftballer-types";
import { getEraBaselines } from "@sportverse/sports-db";
import { peakWeightStats } from "./peak-weighting.js";
import { repairSeasonMinutesRows } from "./minutes.js";
import {
  positionMetricPercentile,
  positionMetricPercentileInverted,
  shrinkPercentileTowardNeutral,
  minutesReliabilityFactor,
  type PercentileMetricKey,
} from "./position-percentiles.js";

export type SubMetricKey =
  | "goals_per_90"
  | "npxg_per_90"
  | "assists_per_90"
  | "minutes_per_app"
  | "conversion_rate"
  | "set_piece_proxy"
  | "def_actions_proxy"
  | "aerial_proxy"
  | "pass_volume"
  | "dribble_proxy"
  | "clean_sheet_proxy"
  | "saves_proxy"
  | "progressive_pass_proxy"
  | "progressive_carry_proxy"
  | "defensive_value_proxy"
  | "discipline_proxy"
  | "availability_rate";

export type SubMetricVector = Partial<Record<SubMetricKey, number>>;

function clamp(n: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, n));
}

function filterStats(
  stats: PlayerSeasonStat[],
  mode: DraftModeConfig,
  position?: Position,
): PlayerSeasonStat[] {
  let rows = repairSeasonMinutesRows(stats);
  if (mode.ratingLens === "club_only") rows = rows.filter((s) => s.context === "CLUB");
  if (mode.ratingLens === "international_only") rows = rows.filter((s) => s.context === "NATIONAL_TEAM");
  if (mode.era === "all_time" || mode.era === "decade") rows = peakWeightStats(rows, 4, position);
  return rows;
}

function aggregate(rows: PlayerSeasonStat[]) {
  const apps = rows.reduce((s, r) => s + r.appearances, 0) || 1;
  const goals = rows.reduce((s, r) => s + r.goals, 0);
  const assists = rows.reduce((s, r) => s + r.assists, 0);
  const minutes = rows.reduce((s, r) => s + r.minutes, 0);
  const penaltyGoals = rows.reduce((s, r) => s + (r.penaltyGoals ?? 0), 0);
  const cleanSheets = rows.reduce((s, r) => s + (r.cleanSheets ?? 0), 0);
  const yellowCards = rows.reduce((s, r) => s + (r.yellowCards ?? 0), 0);
  const redCards = rows.reduce((s, r) => s + (r.redCards ?? 0), 0);
  const shots = rows.reduce((s, r) => s + (r.shots ?? 0), 0) || Math.max(goals * 2, 1);
  const goalsConceded = rows.reduce((s, r) => s + (r.goalsConceded ?? 0), 0);
  return {
    apps,
    goals,
    assists,
    minutes,
    penaltyGoals,
    cleanSheets,
    yellowCards,
    redCards,
    shots,
    goalsConceded,
    mpg: minutes / apps,
  };
}

/** Percentile (0–100) → unit (0–1) with sample-size shrinkage toward neutral. */
function percentileToUnit(
  position: Position,
  metric: PercentileMetricKey,
  value: number,
  reliability: number,
  invert = false,
): number {
  const pct = invert
    ? positionMetricPercentileInverted(position, metric, value)
    : positionMetricPercentile(position, metric, value);
  const shrunk = shrinkPercentileTowardNeutral(pct, reliability);
  return clamp(shrunk / 100);
}

/** Extract position-percentile sub-metrics (0–1) from season rows. */
export function extractSubMetrics(
  stats: PlayerSeasonStat[],
  position: Position,
  mode: DraftModeConfig,
): SubMetricVector {
  const rows = filterStats(stats, mode, position);
  if (!rows.length) return {};

  const agg = aggregate(rows);
  const reliability = minutesReliabilityFactor(agg.minutes, agg.apps);
  const baselines = getEraBaselines();
  const competitionId = rows[0]?.competitionId;
  const playerGpgBaseline =
    baselines.find(
      (b) =>
        b.stat === "goals_per_appearance" &&
        (b.competitionId === competitionId || b.competitionId === "any"),
    )?.mean ?? 0.12;

  const gpg = agg.goals / agg.apps;
  const apg = agg.assists / agg.apps;
  const npg = Math.max(0, agg.goals - agg.penaltyGoals);
  const gp90 = (agg.goals / Math.max(agg.minutes, 1)) * 90;
  const npxg90 = (npg / Math.max(agg.minutes, 1)) * 90;
  const ap90 = (agg.assists / Math.max(agg.minutes, 1)) * 90;
  const gi90 = gp90 + ap90;
  const gc90 = (agg.goalsConceded / Math.max(agg.minutes, 1)) * 90;
  const csRate = agg.cleanSheets / agg.apps;
  const cards90 = ((agg.yellowCards + agg.redCards * 2) / Math.max(agg.minutes, 1)) * 90;
  const availabilityRate = Math.min(1, agg.apps / 38);

  const vector: SubMetricVector = {
    goals_per_90: percentileToUnit(position, "goals_per_90", gp90, reliability),
    npxg_per_90: percentileToUnit(position, "npxg_per_90", npxg90, reliability),
    assists_per_90: percentileToUnit(position, "assists_per_90", ap90, reliability),
    minutes_per_app: percentileToUnit(position, "minutes_per_app", agg.mpg, reliability),
    conversion_rate: clamp(0.5 + 0.5 * Math.tanh(((agg.goals / agg.shots) - 0.12) / 0.15)),
    set_piece_proxy: clamp((gpg * 0.15 + apg * 0.05) / Math.max(playerGpgBaseline, 0.08)),
    pass_volume: percentileToUnit(position, "assists_per_90", ap90, reliability) * 0.6 +
      percentileToUnit(position, "goals_per_90", gp90, reliability) * 0.4,
    dribble_proxy: percentileToUnit(position, "goal_involvement_per_90", gi90, reliability) * 0.55 +
      percentileToUnit(position, "minutes_per_app", agg.mpg, reliability) * 0.45,
    def_actions_proxy:
      percentileToUnit(position, "minutes_per_app", agg.mpg, reliability) * 0.45 +
      percentileToUnit(position, "goals_per_90", gp90, reliability, true) * 0.25 +
      (agg.goalsConceded > 0
        ? percentileToUnit(position, "goals_conceded_per_90", gc90, reliability, true) * 0.3
        : 0.3),
    aerial_proxy:
      percentileToUnit(position, "minutes_per_app", agg.mpg, reliability) * 0.55 +
      percentileToUnit(position, "goals_per_90", gp90, reliability) * 0.2 +
      percentileToUnit(position, "assists_per_90", ap90, reliability) * 0.25,
    clean_sheet_proxy:
      agg.cleanSheets > 0
        ? percentileToUnit(position, "clean_sheet_rate", csRate, reliability)
        : clamp(0.5 + 0.5 * Math.tanh((0.35 - gpg) / 0.12)),
    saves_proxy: percentileToUnit(position, "minutes_per_app", agg.mpg, reliability),
    progressive_pass_proxy: percentileToUnit(position, "assists_per_90", ap90, reliability) * 0.55 +
      percentileToUnit(position, "goal_involvement_per_90", gi90, reliability) * 0.45,
    progressive_carry_proxy: percentileToUnit(position, "goals_per_90", gp90, reliability) * 0.45 +
      percentileToUnit(position, "assists_per_90", ap90, reliability) * 0.35 +
      percentileToUnit(position, "minutes_per_app", agg.mpg, reliability) * 0.2,
    defensive_value_proxy:
      agg.goalsConceded > 0
        ? percentileToUnit(position, "goals_conceded_per_90", gc90, reliability, true) * 0.55 +
          percentileToUnit(position, "minutes_per_app", agg.mpg, reliability) * 0.45
        : percentileToUnit(position, "minutes_per_app", agg.mpg, reliability) * 0.65 +
          percentileToUnit(position, "goals_per_90", gp90, reliability, true) * 0.35,
    discipline_proxy:
      cards90 > 0
        ? percentileToUnit(position, "discipline_per_90", cards90, reliability, true)
        : 0.55,
    availability_rate: clamp(availabilityRate * 0.7 + reliability * 0.3),
  };

  if (position === "GK") {
    vector.saves_proxy = percentileToUnit(position, "minutes_per_app", agg.mpg, reliability);
    vector.clean_sheet_proxy =
      agg.cleanSheets > 0
        ? percentileToUnit(position, "clean_sheet_rate", csRate, reliability)
        : clamp((agg.apps - agg.goals) / agg.apps);
    vector.defensive_value_proxy =
      agg.goalsConceded > 0
        ? percentileToUnit(position, "goals_conceded_per_90", gc90, reliability, true)
        : vector.clean_sheet_proxy ?? 0.5;
  }

  return vector;
}
