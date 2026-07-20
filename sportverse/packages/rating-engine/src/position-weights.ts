import type { PlayerAttributes, Position } from "@sportverse/draftballer-types";

export const POSITION_WEIGHTS: Record<Position, Record<keyof PlayerAttributes, number>> = {
  ST: { pac: 0.12, sho: 0.3, pas: 0.1, dri: 0.18, def: 0.05, phy: 0.25 },
  W: { pac: 0.22, sho: 0.16, pas: 0.18, dri: 0.28, def: 0.06, phy: 0.1 },
  AM: { pac: 0.1, sho: 0.16, pas: 0.3, dri: 0.26, def: 0.08, phy: 0.1 },
  CM: { pac: 0.1, sho: 0.1, pas: 0.28, dri: 0.16, def: 0.2, phy: 0.16 },
  DM: { pac: 0.08, sho: 0.05, pas: 0.2, dri: 0.1, def: 0.35, phy: 0.22 },
  FB: { pac: 0.2, sho: 0.04, pas: 0.2, dri: 0.14, def: 0.28, phy: 0.14 },
  CB: { pac: 0.1, sho: 0.02, pas: 0.12, dri: 0.06, def: 0.42, phy: 0.28 },
  GK: { pac: 0.05, sho: 0.02, pas: 0.08, dri: 0.05, def: 0.35, phy: 0.45 },
};

export function mapQuizPosition(position?: string): Position {
  const p = (position ?? "").toLowerCase();
  if (p.includes("goal")) return "GK";
  if (p.includes("centre-back") || p.includes("center-back") || p === "cb") return "CB";
  if (p.includes("back") || p.includes("wing-back")) return "FB";
  if (p.includes("defensive mid")) return "DM";
  if (p.includes("attacking mid")) return "AM";
  if (p.includes("midfield") || p.includes("midfielder")) return "CM";
  if (p.includes("winger") || p.includes("wing")) return "W";
  if (p.includes("forward") || p.includes("striker") || p.includes("attack")) return "ST";
  // Coarse "Defender" (no side info) reads as centre-back, not midfielder.
  if (p.includes("defend")) return "CB";
  return "CM";
}

export function ovrFromAttributes(position: Position, attrs: PlayerAttributes): number {
  const w = POSITION_WEIGHTS[position];
  const raw =
    attrs.pac * w.pac +
    attrs.sho * w.sho +
    attrs.pas * w.pas +
    attrs.dri * w.dri +
    attrs.def * w.def +
    attrs.phy * w.phy;
  return Math.max(1, Math.min(99, Math.round(raw)));
}

export function tierFromOvr(ovr: number): import("@sportverse/draftballer-types").RatingTier {
  if (ovr >= 90) return "prismatic";
  if (ovr >= 85) return "gold_plus";
  if (ovr >= 75) return "gold";
  if (ovr >= 65) return "silver";
  return "bronze";
}

const ATTR_CAPS: Partial<Record<Position, Partial<Record<keyof PlayerAttributes, number>>>> = {
  CB: { sho: 68 },
  ST: { def: 55 },
  GK: { sho: 55, dri: 55, pas: 55 },
};

export function applyPositionAttributeCaps(
  position: Position,
  attrs: PlayerAttributes,
  stats: { goals?: number; appearances?: number }[],
): PlayerAttributes {
  const out = { ...attrs };
  const caps = ATTR_CAPS[position];
  if (caps) {
    for (const [k, max] of Object.entries(caps) as [keyof PlayerAttributes, number][]) {
      if (out[k] > max) out[k] = max;
    }
  }
  if (position === "CB") {
    const apps = stats.reduce((s, r) => s + (r.appearances ?? 0), 0);
    const goals = stats.reduce((s, r) => s + (r.goals ?? 0), 0);
    if (apps > 0 && goals / apps <= 0.15 && out.sho > 68) out.sho = 68;
  }
  return out;
}
