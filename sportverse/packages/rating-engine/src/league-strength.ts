import { getEngineCalibration } from "@sportverse/sports-db";
import type { PlayerSeasonStat } from "@sportverse/sports-db";
import {
  getConfederationStrengthIndex,
  getLeagueStrengthIndex,
  lsiConfidenceLabel,
  resolveCompetitionToLeague,
} from "@sportverse/sports-db";
import type { DraftModeConfig, PlayerAttributes } from "@sportverse/draftballer-types";
import { ovrFromAttributes } from "./position-weights.js";
import type { Position } from "@sportverse/draftballer-types";

export interface LeagueContextBreakdown {
  competitionId: string;
  seasonLabel: string;
  strengthIndex: number;
  confidence: number;
  confidenceLabel: string;
  pointSwing: number;
  scalingFactor: number;
  baselineShift: number;
  skipped?: boolean;
  skipReason?: string;
  lens: "club" | "international";
}

type MacroKey = keyof PlayerAttributes;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function clampRating(n: number): number {
  return Math.max(1, Math.min(99, Math.round(n)));
}

/** §2.1 bounded scaling factor — uses archive-fitted params when engine-calibration.json is loaded. */
export function scalingFactor(lsi: number): number {
  const b = getEngineCalibration().leagueBridging;
  return clamp(b.scalingBase + b.scalingSlope * (lsi - 1), b.scalingMin, b.scalingMax);
}

/** §2.1 bounded baseline shift — archive-fitted when available. */
export function baselineShift(lsi: number): number {
  const b = getEngineCalibration().leagueBridging;
  return clamp(b.shiftSlope * (lsi - 1), b.shiftMin, b.shiftMax);
}

/** §3 differential bridging sensitivity by attribute. */
export const BRIDGE_SENSITIVITY: Record<MacroKey, number> = {
  sho: 1,
  pas: 1,
  def: 1,
  dri: 0.7,
  pac: 0,
  phy: 0,
};

/** Inverse of sigmoidScale — clamp input so elite ratings stay in realistic z range (~±2.8). */
export function ratingToLeagueZ(rating: number): number {
  const x = clamp((rating - 50) / 20, -0.95, 0.95);
  return 1.5 * Math.atanh(x);
}

/** Macro z-scores from micro-layer unit values (0–1) — scaled to match §2 worked example (+2.3 z). */
export function macroZFromMicroUnit(unit: number): number {
  return clamp((unit - 0.5) * 9, -3, 3.5);
}

export function macroZFromMicroAttrs(attrs: PlayerAttributes): Record<MacroKey, number> {
  const out = {} as Record<MacroKey, number>;
  for (const key of Object.keys(BRIDGE_SENSITIVITY) as MacroKey[]) {
    const unit = clamp((attrs[key] - 40) / 58, 0, 1);
    out[key] = macroZFromMicroUnit(unit);
  }
  return out;
}

export function sigmoidFromZ(z: number): number {
  return clampRating(50 + 20 * Math.tanh(z / 1.5));
}

/** Reconstruct display attrs from league-local macro z-scores (consistent reference for pointSwing). */
export function attrsFromMacroZ(
  zScores: Partial<Record<MacroKey, number>>,
  fallback: PlayerAttributes,
): PlayerAttributes {
  const out = { ...fallback };
  for (const key of Object.keys(BRIDGE_SENSITIVITY) as MacroKey[]) {
    if (zScores[key] != null) {
      out[key] = sigmoidFromZ(zScores[key]!);
    }
  }
  return out;
}

/** OVR from league-local macro z before cross-league bridging. */
export function ovrFromMacroZ(
  position: Position,
  zScores: Partial<Record<MacroKey, number>>,
  fallback: PlayerAttributes,
): number {
  return ovrFromAttributes(position, attrsFromMacroZ(zScores, fallback));
}

/** Bridge a single attribute's league z-score to global z (§2.1 + §3). */
export function bridgeLeagueZ(leagueZ: number, lsi: number, sensitivity: number): number {
  if (sensitivity <= 0) return leagueZ;
  const sf = scalingFactor(lsi);
  const effectiveSf = 1 + sensitivity * (sf - 1);
  return leagueZ * effectiveSf;
}

export function shouldApplyLeagueBridging(mode: DraftModeConfig): boolean {
  if (mode.rawDomesticDominance) return false;
  if (mode.competitionScope === "single_league") return false;
  return true;
}

function seasonLabelForRow(row: PlayerSeasonStat): string {
  const y = Number(row.seasonLabel);
  return Number.isFinite(y) ? row.seasonLabel : "2020";
}

/** Weighted dominant league-season from filtered stat rows. */
export function resolveDominantLeagueContext(
  rows: PlayerSeasonStat[],
  lens: "club" | "international",
): { competitionId: string; seasonLabel: string; weight: number } | null {
  if (!rows.length) return null;
  const filtered =
    lens === "club" ? rows.filter((r) => r.context === "CLUB") : rows.filter((r) => r.context === "NATIONAL_TEAM");
  if (!filtered.length) return null;

  const weights = new Map<string, number>();
  for (const row of filtered) {
    const key =
      lens === "club"
        ? `${resolveCompetitionToLeague(row.competitionId) ?? row.competitionId}::${seasonLabelForRow(row)}`
        : `${row.competitionId}::${seasonLabelForRow(row)}`;
    const w = row.appearances * Math.max(row.minutes, 1);
    weights.set(key, (weights.get(key) ?? 0) + w);
  }

  let bestKey = "";
  let bestW = 0;
  for (const [key, w] of weights) {
    if (w > bestW) {
      bestW = w;
      bestKey = key;
    }
  }
  if (!bestKey) return null;
  const [competitionId, seasonLabel] = bestKey.split("::");
  return { competitionId: competitionId!, seasonLabel: seasonLabel!, weight: bestW };
}

function lookupStrength(
  competitionId: string,
  seasonLabel: string,
  lens: "club" | "international",
): { strength: number; confidence: number; fixtures: number; transfers: number } | null {
  if (lens === "international") {
    const csi = getConfederationStrengthIndex(competitionId, seasonLabel);
    if (!csi) return null;
    return {
      strength: csi.csiFinal,
      confidence: csi.confidence,
      fixtures: csi.crossConfederationFixtures,
      transfers: csi.transferComparisons,
    };
  }
  const lsi = getLeagueStrengthIndex(competitionId, seasonLabel);
  if (!lsi) return null;
  return {
    strength: lsi.lsiFinal,
    confidence: lsi.confidence,
    fixtures: lsi.crossLeagueFixtures,
    transfers: lsi.transferComparisons,
  };
}

/** Apply LSI/CSI bridging to attributes — returns adjusted attrs + explainability block. */
export function applyLeagueStrengthBridging(
  attrs: PlayerAttributes,
  stats: PlayerSeasonStat[],
  mode: DraftModeConfig,
  position: Position,
  lens: "club" | "international",
  macroZ?: Partial<Record<MacroKey, number>>,
): { attrs: PlayerAttributes; leagueContext?: LeagueContextBreakdown } {
  if (!shouldApplyLeagueBridging(mode)) {
    return {
      attrs,
      leagueContext: {
        competitionId: mode.leagueId ?? "—",
        seasonLabel: "—",
        strengthIndex: 1,
        confidence: 1,
        confidenceLabel: mode.rawDomesticDominance
          ? "Raw Domestic Dominance enabled — bridging skipped"
          : "Single League mode — no cross-league bridging",
        pointSwing: 0,
        scalingFactor: 1,
        baselineShift: 0,
        skipped: true,
        skipReason: mode.rawDomesticDominance ? "raw_domestic_dominance" : "single_league_mode",
        lens,
      },
    };
  }

  const dominant = resolveDominantLeagueContext(stats, lens);
  if (!dominant) return { attrs };

  const lookup = lookupStrength(dominant.competitionId, dominant.seasonLabel, lens);
  if (!lookup) return { attrs };

  const sf = scalingFactor(lookup.strength);
  const bs = baselineShift(lookup.strength);

  const zScores = macroZ ?? macroZFromMicroAttrs(attrs);
  // pointSwing must compare league-local performance (macro z) to global bridged OVR — not mismatched attrs.
  const ovrBefore = ovrFromMacroZ(position, zScores, attrs);
  const bridged = { ...attrs };
  for (const key of Object.keys(BRIDGE_SENSITIVITY) as MacroKey[]) {
    const sens = BRIDGE_SENSITIVITY[key];
    const leagueZ = zScores[key] ?? ratingToLeagueZ(attrs[key]);
    const globalZ = bridgeLeagueZ(leagueZ, lookup.strength, sens);
    bridged[key] = sigmoidFromZ(globalZ);
  }

  const ovrAfterAttrs = ovrFromAttributes(position, bridged);
  const ovrAfter = clampRating(ovrAfterAttrs + bs);
  const pointSwing = Math.round((ovrAfter - ovrBefore) * 10) / 10;

  return {
    attrs: bridged,
    leagueContext: {
      competitionId: dominant.competitionId,
      seasonLabel: dominant.seasonLabel,
      strengthIndex: Math.round(lookup.strength * 100) / 100,
      confidence: lookup.confidence,
      confidenceLabel: lsiConfidenceLabel(lookup.confidence, lookup.fixtures, lookup.transfers),
      pointSwing,
      scalingFactor: Math.round(sf * 1000) / 1000,
      baselineShift: Math.round(bs * 10) / 10,
      lens,
    },
  };
}
