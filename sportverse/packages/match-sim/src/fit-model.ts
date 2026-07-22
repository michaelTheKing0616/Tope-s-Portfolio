import type {
  EraProfile,
  FitReportLine,
  PlayerAttributes,
  PlayerMetaAttributes,
  PitchZone,
  RatedPlayerCard,
  TacticalIdentity,
} from "@sportverse/draftballer-types";
import type { PlayerSeasonStat } from "@sportverse/sports-db";
import { computePlayerMeta } from "./player-meta.js";
import { eraProfileIdFromSeasonLabel } from "./era-profiles.js";

/** Physicality fit scale — calibrated prior (Sim Engine v5). */
const ALPHA = 0.85;
/** Technical dampener scale — calibrated prior. */
const BETA = 0.22;
/** Fatigue toll scale — calibrated prior. */
const GAMMA = 0.03;
/** Max anachronism pull on attribute fit (−0.12…+0.08). */
const ANACHRONISM_SCALE = 0.1;

function norm(v: number): number {
  return Math.max(0, Math.min(1, v / 99));
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export interface FitTerms {
  physicalityFitTerm: number;
  /** Peak-career decade vs match era (negative when out of time). */
  anachronismTerm: number;
  technicalDampenerDri: number;
  technicalDampenerPas: number;
  tacticalChaosSpread: number;
  tacticalIdentityMultiplier: Record<keyof PlayerAttributes, number>;
}

const DECADE_ORDER = [
  "1950s-60s",
  "1970s-80s",
  "1990s",
  "2000s",
  "2010s",
  "2020s",
] as const;

function decadeIndex(profileId: string): number {
  if (profileId.includes("serie") || profileId.includes("world-cup")) {
    return DECADE_ORDER.indexOf("1970s-80s");
  }
  const i = DECADE_ORDER.indexOf(profileId as (typeof DECADE_ORDER)[number]);
  return i >= 0 ? i : DECADE_ORDER.indexOf("2020s");
}

/** Best season by minutes → era profile id for that player's peak. */
export function playerPeakEraId(stats: PlayerSeasonStat[]): string | null {
  if (!stats.length) return null;
  let best: PlayerSeasonStat | null = null;
  for (const row of stats) {
    if (!best || row.minutes > best.minutes) best = row;
  }
  if (!best?.seasonLabel) return null;
  return eraProfileIdFromSeasonLabel(best.seasonLabel);
}

/**
 * How far a player's peak era is from the match era.
 * Modern technicians in Hard Men eras get a modest tax; reverse for physical peaks in modern football.
 */
export function computeAnachronismTerm(
  era: EraProfile,
  attrs: PlayerAttributes,
  meta: PlayerMetaAttributes,
  peakEraId: string | null,
): number {
  if (!peakEraId) return 0;
  const gap = decadeIndex(era.id) - decadeIndex(peakEraId);
  if (gap === 0) return 0;
  const tech = meta.technicalRelianceIndex;
  const phy = norm(attrs.phy);
  // Playing "in the past" relative to peak (e.g. 2020s star in 1970s).
  if (gap < 0) {
    const severity = Math.min(3, Math.abs(gap));
    return clamp(-ANACHRONISM_SCALE * severity * (0.4 + tech * 0.6), -0.12, 0.08);
  }
  // Playing "in the future" relative to peak (e.g. 1970s hard man in 2020s).
  const severity = Math.min(3, gap);
  return clamp(-ANACHRONISM_SCALE * severity * (0.35 + (1 - phy) * 0.4), -0.1, 0.06);
}

export function computePhysicalityFitTerm(
  era: EraProfile,
  attrs: PlayerAttributes,
  meta: PlayerMetaAttributes,
): number {
  const mismatch = (era.physicality_intensity - 0.5) * 2;
  const playerEdge =
    0.6 * norm(attrs.phy) +
    0.4 * norm(meta.durability) -
    (0.5 * norm(attrs.dri) + 0.5 * norm(attrs.pas) + 0.2 * meta.technicalRelianceIndex);
  return clamp(ALPHA * mismatch * playerEdge, -0.2, 0.2);
}

export function computeTechnicalDampener(
  era: EraProfile,
  attrs: PlayerAttributes,
): { dri: number; pas: number } {
  const reliance = (norm(attrs.dri) + norm(attrs.pas)) / 2;
  const dampener = 1 - BETA * (1 - era.pitch_ball_quality) * reliance;
  return { dri: dampener, pas: dampener };
}

export function tacticalChaosSpread(era: EraProfile): number {
  return 0.15 + (1 - era.tactical_sophistication) * 0.35;
}

export function tacticalIdentityAttributeWeights(identity: TacticalIdentity): Record<
  keyof PlayerAttributes,
  number
> {
  const base = { pac: 1, sho: 1, pas: 1, dri: 1, def: 1, phy: 1 };
  switch (identity) {
    case "possession":
      return { ...base, pas: 1.12, dri: 1.1, def: 0.95 };
    case "high_press":
      return { ...base, def: 1.12, phy: 1.1, pac: 1.05 };
    case "counter":
      return { ...base, pac: 1.15, sho: 1.08, pas: 0.92 };
    case "route_one":
      return { ...base, phy: 1.15, sho: 1.05, pas: 0.88, dri: 0.9 };
    default:
      return base;
  }
}

export function computeFitTerms(
  era: EraProfile,
  attrs: PlayerAttributes,
  meta: PlayerMetaAttributes,
  identity: TacticalIdentity,
  peakEraId: string | null = null,
): FitTerms {
  const damp = computeTechnicalDampener(era, attrs);
  return {
    physicalityFitTerm: computePhysicalityFitTerm(era, attrs, meta),
    anachronismTerm: computeAnachronismTerm(era, attrs, meta, peakEraId),
    technicalDampenerDri: damp.dri,
    technicalDampenerPas: damp.pas,
    tacticalChaosSpread: tacticalChaosSpread(era),
    tacticalIdentityMultiplier: tacticalIdentityAttributeWeights(identity),
  };
}

export function effectiveAttributes(
  base: PlayerAttributes,
  terms: FitTerms,
  fatigueMultiplier: number,
  momentumMultiplier: number,
  zoneOverloadModifier: number,
  roleFitModifier = 0,
): PlayerAttributes {
  const fit = 1 + terms.physicalityFitTerm + terms.anachronismTerm + roleFitModifier;
  const zone = 1 + zoneOverloadModifier;
  const mom = momentumMultiplier;
  const fat = fatigueMultiplier;

  const apply = (key: keyof PlayerAttributes, extra = 1): number => {
    let v = base[key] * fit * terms.tacticalIdentityMultiplier[key] * extra * zone * mom * fat;
    if (key === "dri") v *= terms.technicalDampenerDri;
    if (key === "pas") v *= terms.technicalDampenerPas;
    return Math.max(1, Math.min(99, Math.round(v)));
  };

  return {
    pac: apply("pac"),
    sho: apply("sho"),
    pas: apply("pas"),
    dri: apply("dri"),
    def: apply("def"),
    phy: apply("phy"),
  };
}

export function fatigueTollProbability(
  era: EraProfile,
  meta: PlayerMetaAttributes,
  weatherMultiplier = 1,
): number {
  return GAMMA * era.tackling_leniency * (1 - norm(meta.durability)) * weatherMultiplier;
}

export function buildFitSummary(
  baseOvr: number,
  effectiveOvr: number,
  era: EraProfile,
  meta: PlayerMetaAttributes,
): { delta: number; summary: string; tags: string[] } {
  const delta = effectiveOvr - baseOvr;
  const tags: string[] = [];
  if (meta.technicalRelianceIndex >= 0.55 && era.physicality_intensity >= 0.75) {
    tags.push("technical_mismatch");
  }
  if (meta.technicalRelianceIndex <= 0.35 && era.pitch_ball_quality >= 0.85) {
    tags.push("physical_mismatch");
  }
  if (delta >= 4) tags.push("overperformed");
  if (delta <= -4) tags.push("underperformed");

  let summary: string;
  if (delta <= -4 && tags.includes("technical_mismatch")) {
    summary = `Bullied off the ball in this era's tackling conditions (${delta}).`;
  } else if (delta >= 4 && era.physicality_intensity >= 0.7) {
    summary = `Thrived in the physical battle (+${delta}).`;
  } else if (delta >= 4) {
    summary = `Overperformed by +${delta}: thrived in these conditions.`;
  } else if (delta <= -4) {
    summary = `Underperformed by ${delta}: struggled in this era's conditions.`;
  } else {
    summary = `Performed close to base rating (${delta >= 0 ? "+" : ""}${delta}).`;
  }

  return { delta, summary, tags };
}

/** Position-relevant attribute weights — a GK's card OVR never came from his shooting. */
const POSITION_ATTR_WEIGHTS: Record<string, PlayerAttributes> = {
  GK: { pac: 0.05, sho: 0.02, pas: 0.1, dri: 0.03, def: 0.55, phy: 0.25 },
  CB: { pac: 0.1, sho: 0.02, pas: 0.1, dri: 0.05, def: 0.48, phy: 0.25 },
  FB: { pac: 0.22, sho: 0.05, pas: 0.15, dri: 0.12, def: 0.3, phy: 0.16 },
  DM: { pac: 0.1, sho: 0.05, pas: 0.22, dri: 0.12, def: 0.32, phy: 0.19 },
  CM: { pac: 0.1, sho: 0.12, pas: 0.32, dri: 0.2, def: 0.14, phy: 0.12 },
  AM: { pac: 0.12, sho: 0.2, pas: 0.28, dri: 0.26, def: 0.04, phy: 0.1 },
  W: { pac: 0.28, sho: 0.2, pas: 0.15, dri: 0.27, def: 0.03, phy: 0.07 },
  ST: { pac: 0.18, sho: 0.42, pas: 0.1, dri: 0.16, def: 0.02, phy: 0.12 },
};

function positionWeightedScore(attrs: PlayerAttributes, position: string): number {
  const w = POSITION_ATTR_WEIGHTS[position] ?? POSITION_ATTR_WEIGHTS.CM!;
  return (
    attrs.pac * w.pac +
    attrs.sho * w.sho +
    attrs.pas * w.pas +
    attrs.dri * w.dri +
    attrs.def * w.def +
    attrs.phy * w.phy
  );
}

/**
 * Effective OVR = card OVR scaled by the position-weighted attribute ratio.
 * Era conditions still move it (dampened attrs → ratio < 1), but a keeper's
 * low shooting no longer masquerades as a "-45 era collapse".
 */
export function effectiveOvrForPosition(
  baseOvr: number,
  baseAttrs: PlayerAttributes,
  effAttrs: PlayerAttributes,
  position: string,
): number {
  const baseScore = positionWeightedScore(baseAttrs, position);
  if (baseScore <= 0) return baseOvr;
  const ratio = positionWeightedScore(effAttrs, position) / baseScore;
  return Math.max(1, Math.min(99, Math.round(baseOvr * ratio)));
}

/**
 * Per-player era fit without running a match — used for pre-sim preview + season Fit Report.
 * Hand calc check: phy=90, dri=pas=40, era.physicality=0.9 → playerEdge > 0 → positive term.
 */
export function computeSquadFitReport(
  players: RatedPlayerCard[],
  era: EraProfile,
  identity: TacticalIdentity = "balanced",
  statsFor?: (playerId: string) => PlayerSeasonStat[],
): FitReportLine[] {
  const lines: FitReportLine[] = [];
  for (const p of players) {
    const stats = statsFor?.(p.playerId) ?? [];
    const meta = computePlayerMeta(p, stats);
    const peakEraId = playerPeakEraId(stats);
    const terms = computeFitTerms(era, p.attributes, meta, identity, peakEraId);
    const eff = effectiveAttributes(p.attributes, terms, 1, 1, 0, 0);
    const effOvr = effectiveOvrForPosition(p.ovr, p.attributes, eff, p.position);
    const { delta, summary, tags } = buildFitSummary(p.ovr, effOvr, era, meta);
    if (peakEraId && peakEraId !== era.id && Math.abs(terms.anachronismTerm) >= 0.04) {
      tags.push("era_anachronism");
    }
    lines.push({
      playerId: p.playerId,
      playerName: p.name,
      baseOvr: p.ovr,
      effectiveDelta: delta,
      summary,
      tags,
    });
  }
  return lines.sort((a, b) => Math.abs(b.effectiveDelta) - Math.abs(a.effectiveDelta));
}

/** Squad-average physicality fit term (−0.2…+0.2) for pre-sim hook copy. */
export function squadAveragePhysicalityFit(
  players: RatedPlayerCard[],
  era: EraProfile,
): number {
  if (!players.length) return 0;
  let sum = 0;
  for (const p of players) {
    sum += computePhysicalityFitTerm(era, p.attributes, computePlayerMeta(p));
  }
  return sum / players.length;
}

/** Human-readable pre-sim fit hook, e.g. "Your technicians will struggle in 1974 mud (−8% expected)". */
export function fitPreviewHeadline(players: RatedPlayerCard[], era: EraProfile): string {
  const avg = squadAveragePhysicalityFit(players, era);
  const pct = Math.round(avg * 100);
  if (pct <= -4) {
    return `Your technicians will struggle in ${era.label} mud (${pct}% expected)`;
  }
  if (pct >= 4) {
    return `Your squad is built for ${era.label} conditions (+${pct}% expected)`;
  }
  return `${era.label}: near-neutral fit (${pct >= 0 ? "+" : ""}${pct}% expected)`;
}

export function pickPhaseZone(identity: TacticalIdentity, rng: () => number): PitchZone {
  const zones: PitchZone[] = [
    "def_left",
    "def_center",
    "def_right",
    "mid_left",
    "mid_center",
    "mid_right",
    "att_left",
    "att_center",
    "att_right",
  ];
  const weights: Record<TacticalIdentity, Partial<Record<PitchZone, number>>> = {
    possession: { mid_center: 2, att_center: 1.5, mid_left: 1.2, mid_right: 1.2 },
    high_press: { att_center: 2, att_left: 1.5, att_right: 1.5, mid_center: 1.2 },
    counter: { att_center: 2, att_left: 1.8, att_right: 1.8 },
    route_one: { att_center: 2.5, def_center: 1.2 },
    balanced: {},
  };
  const w = weights[identity];
  const weighted = zones.map((z) => w[z] ?? 1);
  const total = weighted.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let i = 0; i < zones.length; i++) {
    roll -= weighted[i]!;
    if (roll <= 0) return zones[i]!;
  }
  return "mid_center";
}
