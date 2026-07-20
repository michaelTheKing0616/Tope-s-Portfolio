import type { PlayerAttributes, Position } from "@sportverse/draftballer-types";

/**
 * Position weights reverse-engineered from EA FC 26 (16k outfield players).
 * Least-squares fit of overallRating ~ w·faceStats, negative weights clamped
 * to 0 and renormalized. MAE ~0.6–2.5 per position vs EA's published OVR.
 */
export const EA_POSITION_WEIGHTS: Record<Position, Record<keyof PlayerAttributes, number>> = {
  ST: { pac: 0.037, sho: 0.6, pas: 0.008, dri: 0.232, def: 0, phy: 0.123 },
  W: { pac: 0.105, sho: 0.101, pas: 0.341, dri: 0.397, def: 0.004, phy: 0.052 },
  AM: { pac: 0.057, sho: 0.168, pas: 0.312, dri: 0.414, def: 0.011, phy: 0.038 },
  CM: { pac: 0.002, sho: 0.071, pas: 0.318, dri: 0.385, def: 0.16, phy: 0.064 },
  DM: { pac: 0.009, sho: 0, pas: 0.243, dri: 0.159, def: 0.481, phy: 0.108 },
  FB: { pac: 0.137, sho: 0, pas: 0.149, dri: 0.129, def: 0.532, phy: 0.052 },
  CB: { pac: 0.009, sho: 0, pas: 0.051, dri: 0.039, def: 0.726, phy: 0.174 },
  GK: { pac: 0.05, sho: 0.02, pas: 0.08, dri: 0.05, def: 0.35, phy: 0.45 },
};

/** EA FC 26 GK face-stat weights (refitted from 1.8k keepers, Jul 2026). */
export const EA_GK_WEIGHTS = {
  diving: 0.219,
  handling: 0.223,
  kicking: 0.054,
  positioning: 0.255,
  reflexes: 0.25,
};

export interface EaGkAttributes {
  diving: number;
  handling: number;
  kicking: number;
  positioning: number;
  reflexes: number;
}

export interface EaRatingEntry {
  playerId: string;
  eaId: string;
  name: string;
  ovr: number;
  eaPosition: string;
  quizPosition: Position;
  nationality: string;
  team: string;
  league: string;
  attributes?: PlayerAttributes;
  gkAttributes?: EaGkAttributes;
  cardImage?: string;
}

let eaIndex = new Map<string, EaRatingEntry>();

export function setEaFc26Index(entries: EaRatingEntry[]): void {
  eaIndex = new Map(entries.map((e) => [e.playerId, e]));
}

export function getEaRating(playerId: string): EaRatingEntry | undefined {
  return eaIndex.get(playerId);
}

export function hasEaRating(playerId: string): boolean {
  return eaIndex.has(playerId);
}

/** EA-fitted weighted sum — reproduces EA OVR from face stats; uses published OVR when within tolerance. */
export function ovrFromEaAttributes(
  position: Position,
  attrs: PlayerAttributes,
  publishedOvr?: number,
): number {
  const w = EA_POSITION_WEIGHTS[position] ?? EA_POSITION_WEIGHTS.CM;
  const raw =
    attrs.pac * w.pac +
    attrs.sho * w.sho +
    attrs.pas * w.pas +
    attrs.dri * w.dri +
    attrs.def * w.def +
    attrs.phy * w.phy;
  const computed = Math.max(1, Math.min(99, Math.round(raw)));
  // EA applies playstyles/intangibles beyond 6 face stats — trust published OVR when close.
  const tol = publishedOvr != null && publishedOvr >= 86 ? 5 : 4;
  if (publishedOvr != null && Math.abs(computed - publishedOvr) <= tol) return publishedOvr;
  return computed;
}

/** GK OVR from EA keeper face stats — falls back to published OVR when close. */
export function ovrFromEaGkAttributes(gk: EaGkAttributes, publishedOvr?: number): number {
  const raw =
    gk.diving * EA_GK_WEIGHTS.diving +
    gk.handling * EA_GK_WEIGHTS.handling +
    gk.kicking * EA_GK_WEIGHTS.kicking +
    gk.positioning * EA_GK_WEIGHTS.positioning +
    gk.reflexes * EA_GK_WEIGHTS.reflexes;
  const computed = Math.max(1, Math.min(99, Math.round(raw)));
  if (publishedOvr != null && Math.abs(computed - publishedOvr) <= 2) return publishedOvr;
  return computed;
}

/** Prime-era uplift above EA's current-season snapshot for elite players. */
export function eaPrimeUplift(eaOvr: number, isGk = false): number {
  if (eaOvr >= 90) return isGk ? 3 : 2;
  if (eaOvr >= 87) return isGk ? 4 : 3;
  if (eaOvr >= 84) return isGk ? 3 : 2;
  return eaOvr >= 80 ? 1 : 0;
}

/**
 * Blend internal stats-based OVR with EA FC 26 external rating.
 *
 * - `eaCurrentSnapshot`: use EA published OVR exactly (live card mode).
 * - All-time/prime: floor at EA current + prime uplift; stats can push higher.
 */
export function blendWithEaCalibration(
  statsOvr: number,
  eaEntry: EaRatingEntry,
  opts: { eaCurrentSnapshot?: boolean } = {},
): { ovr: number; eaOvr: number; peakUplift: number; primeUplift: number } {
  const isGk = eaEntry.gkAttributes != null;
  // Published EA OVR is the calibration anchor; face stats drive displayed attributes.
  const eaOvr = eaEntry.ovr;

  if (opts.eaCurrentSnapshot) {
    return { ovr: eaEntry.ovr, eaOvr: eaEntry.ovr, peakUplift: 0, primeUplift: 0 };
  }

  const peakUplift = Math.max(0, Math.min(12, statsOvr - eaOvr));
  const primeUplift = eaPrimeUplift(eaOvr, isGk);
  const uplifted = eaOvr + Math.round(peakUplift * 0.45) + primeUplift;
  const ovr = Math.max(statsOvr, eaOvr, uplifted);
  return { ovr, eaOvr, peakUplift, primeUplift };
}
