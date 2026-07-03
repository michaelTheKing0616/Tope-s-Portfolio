import type { PlayerSeasonStat } from "@sportverse/sports-db";
import type { DraftModeConfig, Position } from "@sportverse/draftballer-types";
import { getEraBaselines } from "@sportverse/sports-db";
import { peakWeightStats } from "./peak-weighting.js";

export type SubMetricKey =
  | "goals_per_90"
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
  /** Tier-1 progressive-value PROXY — not true xT/VAEP without event data (Engine v4 §1.2). */
  | "progressive_pass_proxy"
  | "progressive_carry_proxy"
  | "defensive_value_proxy";

export type SubMetricVector = Partial<Record<SubMetricKey, number>>;

function clamp(n: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, n));
}

function filterStats(stats: PlayerSeasonStat[], mode: DraftModeConfig): PlayerSeasonStat[] {
  let rows = stats;
  if (mode.ratingLens === "club_only") rows = rows.filter((s) => s.context === "CLUB");
  if (mode.ratingLens === "international_only") rows = rows.filter((s) => s.context === "NATIONAL_TEAM");
  if (mode.era === "all_time" || mode.era === "decade") rows = peakWeightStats(rows, 4);
  return rows;
}

function aggregate(rows: PlayerSeasonStat[]) {
  const apps = rows.reduce((s, r) => s + r.appearances, 0) || 1;
  const goals = rows.reduce((s, r) => s + r.goals, 0);
  const assists = rows.reduce((s, r) => s + r.assists, 0);
  const minutes = rows.reduce((s, r) => s + r.minutes, 0);
  const shots = rows.reduce((s, r) => s + (r.shots ?? 0), 0) || Math.max(goals * 2, 1);
  const goalsConceded = rows.reduce((s, r) => s + (r.goalsConceded ?? 0), 0);
  return { apps, goals, assists, minutes, shots, goalsConceded, mpg: minutes / apps };
}

function zToUnit(z: number): number {
  return clamp(0.5 + 0.5 * Math.tanh(z / 1.5));
}

/** Extract normalized sub-metrics (0–1) from season rows — micro layer input. */
export function extractSubMetrics(
  stats: PlayerSeasonStat[],
  position: Position,
  mode: DraftModeConfig,
): SubMetricVector {
  const rows = filterStats(stats, mode);
  if (!rows.length) return {};

  const agg = aggregate(rows);
  const baselines = getEraBaselines();
  const competitionId = rows[0]?.competitionId;
  /** Player-level gpg baseline — never use team goals_per_game (≈2.7) for per-player gp90. */
  const playerGpgBaseline =
    baselines.find(
      (b) =>
        b.stat === "goals_per_appearance" &&
        (b.competitionId === competitionId || b.competitionId === "any"),
    )?.mean ?? 0.12;
  const playerGp90Baseline = playerGpgBaseline * (90 / Math.max(agg.mpg, 1));

  const gpg = agg.goals / agg.apps;
  const apg = agg.assists / agg.apps;
  const gp90 = (agg.goals / Math.max(agg.minutes, 1)) * 90;
  const ap90 = (agg.assists / Math.max(agg.minutes, 1)) * 90;

  const vector: SubMetricVector = {
    goals_per_90: zToUnit((gp90 - playerGp90Baseline) / 0.35),
    assists_per_90: zToUnit((ap90 - 0.12 * 90 * 0.5) / 0.25),
    minutes_per_app: zToUnit((agg.mpg - 55) / 25),
    conversion_rate: zToUnit((agg.goals / agg.shots - 0.12) / 0.15),
    set_piece_proxy: zToUnit((gpg * 0.15 + apg * 0.05) / 0.2),
    pass_volume: zToUnit((apg + gpg * 0.3) / 0.5),
    dribble_proxy: zToUnit((gpg * 0.4 + apg * 0.2) / 0.35),
    def_actions_proxy: zToUnit((1 - gpg) * 0.4 + agg.mpg / 120),
    aerial_proxy: zToUnit(gpg * 0.25 + agg.mpg / 100),
    clean_sheet_proxy: zToUnit((90 - gpg * 40) / 90),
    saves_proxy: zToUnit(agg.mpg / 90),
    progressive_pass_proxy: zToUnit((ap90 * 0.55 + apg * 0.35 + gpg * 0.1) / 0.45),
    progressive_carry_proxy: zToUnit((gp90 * 0.35 + apg * 0.25 + agg.mpg / 100) / 0.4),
    defensive_value_proxy: zToUnit(
      ((agg.goalsConceded != null && agg.minutes > 0
        ? 1 - (agg.goalsConceded / agg.apps) * 0.4
        : (1 - gpg) * 0.35) +
        agg.mpg / 110 +
        (1 - apg) * 0.15) /
        0.55,
    ),
  };

  if (position === "GK") {
    vector.saves_proxy = zToUnit(agg.mpg / 85);
    vector.clean_sheet_proxy = zToUnit((agg.apps - agg.goals) / agg.apps);
  }

  return vector;
}
