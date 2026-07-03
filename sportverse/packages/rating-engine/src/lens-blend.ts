import type { DraftModeConfig } from "@sportverse/draftballer-types";

function clamp(n: number, min = 1, max = 99): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** Bible §4.3.3 — lens blend with cross-context synergy bonus. */
export function lensBlend(
  clubOvr: number,
  intlOvr: number,
  lens: DraftModeConfig["ratingLens"],
  blend: number,
): number {
  if (lens === "club_only") return clubOvr;
  if (lens === "international_only") return intlOvr;
  if (lens === "best_context") return Math.max(clubOvr, intlOvr) - 2;

  const b = Math.max(0, Math.min(1, blend));
  let ovr = (1 - b) * clubOvr + b * intlOvr;

  if (clubOvr >= 75 && intlOvr >= 75) {
    ovr += Math.max(0, 3 - Math.abs(clubOvr - intlOvr) / 5);
  }

  return clamp(ovr);
}
