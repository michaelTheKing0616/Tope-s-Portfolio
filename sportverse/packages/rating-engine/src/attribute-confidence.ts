/**
 * Position/attribute confidence discounts — Engine v4 §1.3.
 * Defensive valuation carries structurally lower measurement confidence field-wide.
 */

import type { PlayerAttributes, Position } from "@sportverse/draftballer-types";

/** Baseline multiplier for overall player confidence by position group. */
export function positionConfidenceMultiplier(position: Position): number {
  if (position === "GK") return 0.88;
  if (position === "CB" || position === "FB" || position === "DM") return 0.82;
  return 1;
}

/** Per-attribute discount — DEF macro for outfield defenders is least precisely measured. */
export function attributeConfidenceMultiplier(
  position: Position,
  attribute: keyof PlayerAttributes,
): number {
  const isDefender = position === "CB" || position === "FB" || position === "DM";
  if (isDefender && attribute === "def") return 0.75;
  if (position === "GK" && (attribute === "def" || attribute === "phy")) return 0.8;
  return 1;
}

/** Apply empirical-Bayes-style confidence from sample size + structural discounts. */
export function computeRatingConfidence(
  appearanceSample: number,
  position: Position,
  k = 30,
): number {
  const n = Math.max(0, appearanceSample);
  const shrinkage = n / (n + k);
  const raw = 0.55 + shrinkage * 0.43;
  return Math.min(0.98, raw * positionConfidenceMultiplier(position));
}
