import type { PlayerSeasonStat } from "@sportverse/sports-db";
import { getEraBaselines, resolveCompetitionToLeague } from "@sportverse/sports-db";
import type { DraftModeConfig, PlayerAttributes, Position } from "@sportverse/draftballer-types";
import { ovrFromAttributes } from "./position-weights.js";
import { peakWeightStats } from "./peak-weighting.js";
import { extractSubMetrics } from "./sub-metrics.js";
import { macroFromSubMetrics } from "./micro-coefficients.js";
import {
  attrsFromPillarScores,
  ovrFromPillarScores,
  pillarScoresFromSubMetrics,
} from "./position-pillars.js";
import { gkAttributesFromStats, gkOvrFromAttributes } from "./gk-rating.js";
import {
  applyLeagueStrengthBridging,
  macroZFromMicroUnit,
  type LeagueContextBreakdown,
} from "./league-strength.js";
import { computeRatingConfidence } from "./attribute-confidence.js";
import { repairSeasonMinutesRows } from "./minutes.js";
import type { PlayerAttributes as MacroAttrs } from "@sportverse/draftballer-types";

function clamp(n: number, min = 1, max = 99): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function sigmoidScale(z: number): number {
  return clamp(50 + 20 * Math.tanh(z / 1.5));
}

function seasonToDecade(seasonLabel: string): string {
  const y = Number(seasonLabel);
  if (!y || y < 2000) return "1990s";
  if (y < 2010) return "2000s";
  if (y < 2020) return "2010s";
  return "2020s";
}

function filterStats(
  stats: PlayerSeasonStat[],
  mode: DraftModeConfig,
  position?: Position,
): PlayerSeasonStat[] {
  let rows = repairSeasonMinutesRows(stats);
  if (mode.ratingLens === "club_only") rows = rows.filter((s) => s.context === "CLUB");
  if (mode.ratingLens === "international_only") rows = rows.filter((s) => s.context === "NATIONAL_TEAM");
  if (mode.competitionScope === "single_league" && mode.leagueId) {
    rows = rows.filter((s) => s.competitionId === mode.leagueId || s.competitionId.includes(mode.leagueId!));
  }
  if (mode.competitionScope === "international") {
    rows = rows.filter((s) => s.context === "NATIONAL_TEAM");
  }
  if (mode.era === "decade" && mode.decade) {
    rows = rows.filter((s) => seasonToDecade(s.seasonLabel) === mode.decade);
  }
  if (mode.era === "single_year" && mode.year) {
    rows = rows.filter((s) => s.seasonLabel === String(mode.year));
  }
  if (mode.era === "custom_range" && mode.yearFrom != null && mode.yearTo != null) {
    rows = rows.filter((s) => {
      const y = Number(s.seasonLabel);
      return Number.isFinite(y) && y >= mode.yearFrom! && y <= mode.yearTo!;
    });
  }
  if (mode.competitionScope === "custom" && mode.leagueIds?.length) {
    const leagues = new Set(mode.leagueIds);
    rows = rows.filter((s) => {
      const league = resolveCompetitionToLeague(s.competitionId) ?? s.competitionId;
      return leagues.has(league) || leagues.has(s.competitionId);
    });
  }
  if (mode.primeYearsOnly) {
    rows = peakWeightStats(rows, 4, position);
  }
  if (mode.era === "all_time" || mode.era === "decade") {
    rows = peakWeightStats(rows, 4, position);
  }
  return rows;
}

function aggregate(rows: PlayerSeasonStat[]) {
  const apps = rows.reduce((s, r) => s + r.appearances, 0) || 1;
  const goals = rows.reduce((s, r) => s + r.goals, 0);
  const assists = rows.reduce((s, r) => s + r.assists, 0);
  const minutes = rows.reduce((s, r) => s + r.minutes, 0);
  return {
    apps,
    goals,
    assists,
    minutes,
    gpg: goals / apps,
    apg: assists / apps,
    mpg: minutes / apps,
  };
}

/** Legacy fallback when sub-metrics sparse — sigmoid z-score proxy. */
function legacyAttributesFromAgg(
  agg: ReturnType<typeof aggregate>,
  position: Position,
  rows: PlayerSeasonStat[],
): PlayerAttributes {
  const baselines = getEraBaselines();
  const leagueBaseline =
    baselines.find(
      (b) =>
        b.stat === "goals_per_appearance" &&
        rows.some((r) => r.competitionId === b.competitionId) &&
        b.seasonLabel === rows[0]?.seasonLabel,
    ) ??
    baselines.find((b) => b.stat === "goals_per_game") ??
    baselines.find((b) => b.stat === "goals_per_game");
  const leagueGpg =
    leagueBaseline?.stat === "goals_per_appearance"
      ? (leagueBaseline?.mean ?? 0.12)
      : (leagueBaseline?.mean ?? 2.6) * 0.12;

  const gpgZ = (agg.gpg - leagueGpg) / 0.35;
  const apgZ = (agg.apg - 0.12) / 0.2;
  const minsZ = (agg.mpg - 55) / 25;
  const appsZ = (Math.min(agg.apps, 140) / 35 - 1.5) / 1.2;
  const base = sigmoidScale(minsZ * 0.65 + appsZ * 0.55);
  const isDef = position === "CB" || position === "FB" || position === "DM" || position === "GK";

  return {
    pac: clamp(base + (position === "W" || position === "FB" ? 8 : 0)),
    sho: sigmoidScale(gpgZ + (position === "ST" || position === "W" ? 0.5 : isDef ? -0.55 : -0.3)),
    pas: sigmoidScale(apgZ + (position === "CM" || position === "AM" ? 0.4 : position === "FB" ? 0.15 : 0)),
    dri: clamp(base + (position === "AM" || position === "W" ? 6 : position === "FB" ? 3 : 2)),
    def: sigmoidScale((isDef ? 1.05 : -0.4) + minsZ * 0.45 + appsZ * 0.35),
    phy: sigmoidScale(minsZ * 0.6 + appsZ * 0.25 + (position === "DM" || position === "CB" ? 0.35 : 0)),
  };
}

function legacyMacroZ(
  agg: ReturnType<typeof aggregate>,
  position: Position,
): Record<keyof MacroAttrs, number> {
  const gpgZ = (agg.gpg - 0.12) / 0.35;
  const apgZ = (agg.apg - 0.12) / 0.2;
  const minsZ = (agg.mpg - 55) / 25;
  const appsZ = (Math.min(agg.apps, 140) / 35 - 1.5) / 1.2;
  const isDef = position === "CB" || position === "FB" || position === "DM" || position === "GK";
  return {
    sho: gpgZ + (position === "ST" || position === "W" ? 0.5 : isDef ? -0.55 : -0.3),
    pas: apgZ + (position === "CM" || position === "AM" ? 0.4 : position === "FB" ? 0.15 : 0),
    pac: minsZ + (position === "W" || position === "FB" ? 0.35 : 0),
    dri: minsZ + (position === "AM" || position === "W" ? 0.25 : 0.08),
    def: (isDef ? 1.05 : -0.4) + minsZ * 0.45 + appsZ * 0.35,
    phy: minsZ * 0.6 + appsZ * 0.25 + (position === "DM" || position === "CB" ? 0.35 : 0),
  };
}

/** Minutes/apps floor for defensive roles — starters shouldn't land in the low 50s. */
export function defensiveWorkloadFloor(
  apps: number,
  minutes: number,
  position: Position,
): number {
  if (position !== "CB" && position !== "FB" && position !== "DM") return 0;
  const seasonsEquiv = Math.min(apps / 28, 5);
  const minsEquiv = Math.min(minutes / 2200, 5);
  const workload = Math.max(seasonsEquiv, minsEquiv * 0.9);
  if (workload >= 4) return 78;
  if (workload >= 3) return 74;
  if (workload >= 2) return 70;
  if (workload >= 1.25) return 66;
  if (workload >= 0.75) return 62;
  return 0;
}

function macroZFromMicroBreakdown(
  attrs: MacroAttrs,
  microBreakdown: Record<string, Record<string, number>>,
): Record<keyof MacroAttrs, number> {
  const out = {} as Record<keyof MacroAttrs, number>;
  for (const key of Object.keys(attrs) as (keyof MacroAttrs)[]) {
    const contribs = Object.values(microBreakdown[key] ?? {});
    const unit = contribs.length ? contribs.reduce((a, b) => a + b, 0) : (attrs[key] - 40) / 58;
    out[key] = macroZFromMicroUnit(unit);
  }
  return out;
}

/** Derive attributes from season stat rows — micro layer + macro (§4.1) + optional LSI bridging (§2). */
export function attributesFromSeasonStats(
  stats: PlayerSeasonStat[],
  position: Position,
  mode: DraftModeConfig,
  lens: "club" | "international" = "club",
): {
  attrs: PlayerAttributes;
  confidence: number;
  microBreakdown?: Record<string, Record<string, number>>;
  leagueContext?: LeagueContextBreakdown;
} | null {
  const rows = filterStats(stats, mode, position);
  if (!rows.length) return null;

  const agg = aggregate(rows);
  const confidence = computeRatingConfidence(agg.apps, position);
  const subMetrics = extractSubMetrics(stats, position, mode);

  let attrs: PlayerAttributes;
  let microBreakdown: Record<string, Record<string, number>> | undefined;
  let macroZ: Record<keyof MacroAttrs, number>;

  if (Object.keys(subMetrics).length >= 4) {
    const pillars = pillarScoresFromSubMetrics(position, subMetrics);
    const derived = macroFromSubMetrics(position, subMetrics);
    // Pillar model drives face attrs; micro table retained for breakdown UI.
    attrs = attrsFromPillarScores(position, pillars);
    microBreakdown = derived.microBreakdown;
    macroZ = macroZFromMicroBreakdown(attrs, derived.microBreakdown);
  } else {
    attrs = legacyAttributesFromAgg(agg, position, rows);
    macroZ = legacyMacroZ(agg, position);
  }

  const bridged = applyLeagueStrengthBridging(attrs, rows, mode, position, lens, macroZ);
  return { attrs: bridged.attrs, confidence, microBreakdown, leagueContext: bridged.leagueContext };
}

export function ovrFromSeasonStats(
  stats: PlayerSeasonStat[],
  position: Position,
  mode: DraftModeConfig,
  lens: "club" | "international" = mode.ratingLens === "international_only" ? "international" : "club",
): {
  ovr: number;
  attrs: PlayerAttributes;
  confidence: number;
  microBreakdown?: Record<string, Record<string, number>>;
  gkAttributes?: import("@sportverse/draftballer-types").GKAttributes;
  leagueContext?: LeagueContextBreakdown;
} | null {
  const derived = attributesFromSeasonStats(stats, position, mode, lens);
  if (!derived) return null;

  const filtered = filterStats(stats, mode, position);
  const agg = aggregate(filtered);

  if (position === "GK") {
    const gk = gkAttributesFromStats(filtered);
    if (gk) {
      let ovr = gkOvrFromAttributes(gk);
      if (derived.leagueContext && !derived.leagueContext.skipped) {
        ovr = clamp(ovr + derived.leagueContext.baselineShift);
      }
      return {
        ovr,
        attrs: derived.attrs,
        confidence: derived.confidence,
        microBreakdown: derived.microBreakdown,
        gkAttributes: gk,
        leagueContext: derived.leagueContext,
      };
    }
  }

  let ovr: number;
  const subMetrics = extractSubMetrics(stats, position, mode);
  if (Object.keys(subMetrics).length >= 4) {
    const pillars = pillarScoresFromSubMetrics(position, subMetrics);
    ovr = ovrFromPillarScores(position, pillars, agg.minutes, agg.apps);
  } else {
    ovr = ovrFromAttributes(position, derived.attrs);
  }
  if (derived.leagueContext && !derived.leagueContext.skipped) {
    ovr = clamp(ovr + derived.leagueContext.baselineShift);
  }
  ovr = Math.max(ovr, defensiveWorkloadFloor(agg.apps, agg.minutes, position));

  return {
    ovr,
    attrs: derived.attrs,
    confidence: derived.confidence,
    microBreakdown: derived.microBreakdown,
    leagueContext: derived.leagueContext,
  };
}
