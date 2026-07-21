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

/** Coarse archive labels that don't distinguish side/role — prefer EA when available. */
export function isCoarsePositionLabel(position?: string): boolean {
  const p = (position ?? "").toLowerCase().trim();
  return !p || p === "defender" || p === "midfielder" || p === "midfield" || p === "forward" || p === "attacker";
}

/**
 * Map raw Transfermarkt / quiz position strings → Sportverse quiz Position.
 * Order matters: more specific phrases before coarse ones (e.g. attacking mid before attack).
 */
export function mapQuizPosition(position?: string): Position {
  const raw = (position ?? "").trim();
  const p = raw.toLowerCase();
  if (!p) return "CM";

  // Exact / short codes first
  const code = p.replace(/[^a-z0-9]/g, "");
  const codeMap: Record<string, Position> = {
    gk: "GK",
    goalkeeper: "GK",
    cb: "CB",
    lcb: "CB",
    rcb: "CB",
    sweeper: "CB",
    libero: "CB",
    lb: "FB",
    rb: "FB",
    lwb: "FB",
    rwb: "FB",
    wb: "FB",
    fullback: "FB",
    fullbackleft: "FB",
    fullbackright: "FB",
    wingback: "FB",
    cdm: "DM",
    dm: "DM",
    defensivemidfielder: "DM",
    defensivemidfield: "DM",
    cm: "CM",
    lcm: "CM",
    rcm: "CM",
    centralmidfielder: "CM",
    cam: "AM",
    am: "AM",
    attackingmidfielder: "AM",
    attackingmidfield: "AM",
    lw: "W",
    rw: "W",
    lm: "W",
    rm: "W",
    winger: "W",
    leftwinger: "W",
    rightwinger: "W",
    leftmidfield: "W",
    rightmidfield: "W",
    leftmidfielder: "W",
    rightmidfielder: "W",
    st: "ST",
    cf: "ST",
    ls: "ST",
    rs: "ST",
    striker: "ST",
    forward: "ST",
    centreforward: "ST",
    centerforward: "ST",
    secondstriker: "ST",
  };
  if (codeMap[code]) return codeMap[code];

  if (p.includes("goal")) return "GK";
  if (p.includes("centre-back") || p.includes("center-back") || p.includes("centre back") || p.includes("center back")) {
    return "CB";
  }
  if (p.includes("wing-back") || p.includes("wingback") || p.includes("full-back") || p.includes("fullback")) {
    return "FB";
  }
  if (p.includes("left-back") || p.includes("right-back") || p.includes("left back") || p.includes("right back")) {
    return "FB";
  }
  // Generic "back" after CB/FB specifics (e.g. "Right-Back")
  if (/\b(left|right)?-?backs?\b/.test(p) || p.endsWith("-back") || p.endsWith(" back")) return "FB";

  if (p.includes("defensive mid")) return "DM";
  if (p.includes("attacking mid")) return "AM";
  if (p.includes("left mid") || p.includes("right mid")) return "W";
  if (p.includes("winger") || (p.includes("wing") && !p.includes("back"))) return "W";
  if (p.includes("second striker") || p.includes("centre-forward") || p.includes("center-forward")) return "ST";
  if (p.includes("striker") || p.includes("forward")) return "ST";
  // "attack" alone after attacking-mid already handled
  if (p.includes("attack") && !p.includes("mid")) return "ST";
  if (p.includes("midfield") || p.includes("midfielder")) return "CM";
  if (p.includes("defend")) return "CB";
  return "CM";
}

/**
 * Final role used for OVR math. Prefer EA's precise role when the archive
 * only has a coarse label (Defender/Midfielder/Forward).
 */
export function resolveRatingPosition(rawPosition?: string, eaQuizPosition?: Position): Position {
  const mapped = mapQuizPosition(rawPosition);
  if (!eaQuizPosition) return mapped;
  if (mapped === "GK" || eaQuizPosition === "GK") return "GK";
  if (isCoarsePositionLabel(rawPosition)) return eaQuizPosition;
  return mapped;
}

export function ovrFromAttributes(position: Position, attrs: PlayerAttributes): number {
  const w = POSITION_WEIGHTS[position] ?? POSITION_WEIGHTS.CM;
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
