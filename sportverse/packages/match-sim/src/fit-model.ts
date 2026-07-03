import type {
  EraProfile,
  PlayerAttributes,
  PlayerMetaAttributes,
  PitchZone,
  TacticalIdentity,
} from "@sportverse/draftballer-types";

const ALPHA = 1.0;
const BETA = 0.25;
const GAMMA = 0.035;

function norm(v: number): number {
  return Math.max(0, Math.min(1, v / 99));
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export interface FitTerms {
  physicalityFitTerm: number;
  technicalDampenerDri: number;
  technicalDampenerPas: number;
  tacticalChaosSpread: number;
  tacticalIdentityMultiplier: Record<keyof PlayerAttributes, number>;
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
): FitTerms {
  const damp = computeTechnicalDampener(era, attrs);
  return {
    physicalityFitTerm: computePhysicalityFitTerm(era, attrs, meta),
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
  const fit = 1 + terms.physicalityFitTerm + roleFitModifier;
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
  if (delta >= 4) summary = `Overperformed by +${delta}: thrived in these conditions.`;
  else if (delta <= -4)
    summary = `Underperformed by ${delta}: struggled in this era's conditions.`;
  else summary = `Performed close to base rating (${delta >= 0 ? "+" : ""}${delta}).`;

  return { delta, summary, tags };
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
