import type { DraftModeConfig, PlayerAttributes, RatedPlayerCard, FameTier } from "@sportverse/draftballer-types";
import type { PlayerSeasonStat } from "@sportverse/sports-db";
import { mapQuizPosition, ovrFromAttributes, tierFromOvr } from "./position-weights.js";
import { ovrFromSeasonStats } from "./stats-rating.js";
import { lensBlend } from "./lens-blend.js";
import { awardBonus, bigMomentBonus, legacyReputationBonus, longevityAdjustment } from "./awards.js";
import { communityCalibrationNudge } from "./calibration.js";
import { durabilityForRating, fameScoreForRating, mvPercentileForRating } from "./fame-data.js";
import { applyPositionAttributeCaps } from "./position-weights.js";

export interface RatingInput {
  id: string;
  name: string;
  nationality?: string;
  position?: string;
  clubs?: string[];
  seasonStats?: PlayerSeasonStat[];
  /** Optional hand-tuned override for verified legends */
  manualOvr?: number;
  manualAttributes?: Partial<PlayerAttributes>;
  /** Target season for season-basis ratings */
  seasonLabel?: string;
}

function clamp(n: number, min = 1, max = 99): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function fameTierFromScore(score: number): FameTier {
  if (score >= 92) return "icon";
  if (score >= 75) return "star";
  if (score >= 55) return "known";
  if (score >= 35) return "cult";
  return "obscure";
}

function seeded(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return (h >>> 0) / 4294967295;
  };
}

function deriveAttributes(input: RatingInput, position: ReturnType<typeof mapQuizPosition>): { attrs: PlayerAttributes; fabricated: boolean } {
  const rng = seeded(`${input.id}:${position}`);
  const clubDepth = Math.min(8, input.clubs?.length ?? 1);
  const base = 62 + clubDepth * 2.5;

  const archetype: Record<ReturnType<typeof mapQuizPosition>, Partial<PlayerAttributes>> = {
    ST: { sho: 18, pac: 8, phy: 6 },
    W: { pac: 14, dri: 12, sho: 4 },
    AM: { pas: 14, dri: 10, sho: 6 },
    CM: { pas: 10, def: 6, phy: 4 },
    DM: { def: 14, phy: 8, pas: 4 },
    FB: { pac: 10, def: 10, pas: 4 },
    CB: { def: 16, phy: 12, sho: -8 },
    GK: { def: 14, phy: 10, sho: -12, pac: -6 },
  };

  const bump = archetype[position] ?? {};
  const jitter = () => (rng() - 0.5) * 8;
  const durability = durabilityForRating(input.id);

  let attrs: PlayerAttributes = {
    pac: clamp(base + (bump.pac ?? 0) + jitter()),
    sho: clamp(base + (bump.sho ?? 0) + jitter()),
    pas: clamp(base + (bump.pas ?? 0) + jitter()),
    dri: clamp(base + (bump.dri ?? 0) + jitter()),
    def: clamp(base + (bump.def ?? 0) + jitter()),
    phy: clamp(base + (bump.phy ?? 0) + jitter() + (durability - 0.5) * 10),
  };

  if (input.manualAttributes) {
    attrs = { ...attrs, ...input.manualAttributes };
  }

  attrs = applyPositionAttributeCaps(position, attrs, input.seasonStats ?? []);
  return { attrs, fabricated: true };
}

function contextMode(mode: DraftModeConfig, context: "club" | "intl"): DraftModeConfig {
  if (context === "club") {
    return {
      ...mode,
      ratingLens: "club_only",
      competitionScope: mode.competitionScope === "international" ? "any_league" : mode.competitionScope,
    };
  }
  return {
    ...mode,
    ratingLens: "international_only",
    competitionScope: "international",
  };
}

function filterStatsForSeason(stats: PlayerSeasonStat[], seasonLabel?: string): PlayerSeasonStat[] {
  if (!seasonLabel) return stats;
  const y = Number(seasonLabel.replace(/\/.*/, ""));
  return stats.filter((s) => {
    if (s.seasonLabel === seasonLabel) return true;
    const sy = Number(String(s.seasonLabel).replace(/\/.*/, ""));
    return Number.isFinite(sy) && Number.isFinite(y) && Math.abs(sy - y) <= 1;
  });
}

function ratingFromStats(
  stats: PlayerSeasonStat[] | undefined,
  position: ReturnType<typeof mapQuizPosition>,
  mode: DraftModeConfig,
  context: "club" | "intl",
  seasonLabel?: string,
) {
  if (!stats?.length) return null;
  const filtered = seasonLabel ? filterStatsForSeason(stats, seasonLabel) : stats;
  const useStats = filtered.length ? filtered : stats;
  return ovrFromSeasonStats(
    useStats,
    position,
    contextMode(mode, context),
    context === "intl" ? "international" : "club",
  );
}

/** Cap for role-archetype (fabricated) ratings — UNCALIBRATED — EXPERT PRIOR (Rating Engine v5). */
export const FABRICATED_OVR_CAP = 72;

/** Outfield MV scouting-consensus base blend weight — UNCALIBRATED — EXPERT PRIOR (labeled in breakdown). */
export const MV_BLEND_WEIGHT_OUTFIELD = 0.2;
/** GK MV base blend weight — UNCALIBRATED — EXPERT PRIOR. */
export const MV_BLEND_WEIGHT_GK = 0.15;
/**
 * Extra weight granted quadratically as MV percentile approaches 100 —
 * UNCALIBRATED — EXPERT PRIOR. Goal/assist proxies cannot see defensive or
 * off-ball quality, so era-top market value (the market's scouting consensus)
 * must be able to pull elite defenders/wingers out of the 60s.
 */
export const MV_BLEND_PCT_BONUS = 0.3;
export const MV_BLEND_WEIGHT_MAX = 0.5;

export function mvBlendWeightForPosition(
  position: ReturnType<typeof mapQuizPosition>,
  percentile = 0,
): number {
  const base = position === "GK" ? MV_BLEND_WEIGHT_GK : MV_BLEND_WEIGHT_OUTFIELD;
  const pctUnit = Math.max(0, Math.min(1, percentile / 100));
  return Math.min(MV_BLEND_WEIGHT_MAX, base + MV_BLEND_PCT_BONUS * pctUnit * pctUnit);
}

/**
 * Blend base OVR with era-normalized MV percentile. Weight rises with the
 * percentile itself (see MV_BLEND_PCT_BONUS) — still fame-firewall-safe
 * because MV percentile is independent of fameScore.
 * Hand calc: base=80, pct=50 → mvOvr=round(55+22)=77;
 * weight=0.2+0.3*0.25=0.275 → 80*0.725+77*0.275=79.175→79.
 */
export function mvOvrBlend(
  baseOvr: number,
  playerId: string,
  position: ReturnType<typeof mapQuizPosition>,
): { ovr: number; delta: number; weight: number; percentile: number } {
  const pct = mvPercentileForRating(playerId);
  const weight = mvBlendWeightForPosition(position, pct);
  if (pct <= 0) return { ovr: baseOvr, delta: 0, weight, percentile: 0 };
  const mvOvr = clamp(55 + pct * 0.44);
  const blended = clamp(baseOvr * (1 - weight) + mvOvr * weight);
  return { ovr: blended, delta: blended - baseOvr, weight, percentile: pct };
}

/** Compute OVR for a player under the given draft mode config (rating engine v5). */
export function computePlayerRating(input: RatingInput, mode: DraftModeConfig): RatedPlayerCard {
  const position = mapQuizPosition(input.position);
  const stats = input.seasonStats ?? [];
  const seasonLabel = mode.ratingBasis === "season" ? input.seasonLabel : undefined;
  const fameScore = fameScoreForRating(input.id);

  const clubFromStats = ratingFromStats(stats, position, mode, "club", seasonLabel);
  const intlFromStats = ratingFromStats(stats, position, mode, "intl", seasonLabel);

  const derived = clubFromStats?.attrs ?? intlFromStats?.attrs
    ? { attrs: clubFromStats?.attrs ?? intlFromStats!.attrs, fabricated: false }
    : deriveAttributes(input, position);

  let attrs = derived.attrs;
  let fabricated = derived.fabricated;
  const statConfidence = Math.max(clubFromStats?.confidence ?? 0, intlFromStats?.confidence ?? 0, fabricated ? 0.45 : 0.72);
  const microBreakdown = clubFromStats?.microBreakdown ?? intlFromStats?.microBreakdown;
  const gkAttributes = clubFromStats?.gkAttributes ?? intlFromStats?.gkAttributes;
  const leagueContext =
    mode.ratingLens === "international_only"
      ? intlFromStats?.leagueContext
      : mode.ratingLens === "club_only"
        ? clubFromStats?.leagueContext
        : clubFromStats?.leagueContext ?? intlFromStats?.leagueContext;

  let clubOvr = input.manualOvr ?? clubFromStats?.ovr ?? intlFromStats?.ovr ?? ovrFromAttributes(position, attrs);
  let intlOvr = intlFromStats?.ovr ?? clubFromStats?.ovr ?? clamp(clubOvr - 6);

  if (intlFromStats) {
    intlOvr = intlFromStats.ovr;
  } else if (!stats.some((s) => s.context === "NATIONAL_TEAM")) {
    intlOvr = clamp(clubOvr - 6 + (seeded(`${input.id}:intl`)() > 0.7 ? 4 : 0));
  }

  let mvBlendDelta: number | undefined;
  let mvBlendWeight: number | undefined;
  let mvBlendPct: number | undefined;
  if (!input.manualOvr) {
    const mv = mvOvrBlend(clubOvr, input.id, position);
    clubOvr = mv.ovr;
    if (mv.percentile > 0) {
      mvBlendDelta = mv.delta;
      mvBlendWeight = mv.weight;
      mvBlendPct = mv.percentile;
    }
  }

  const awards = awardBonus(input.id, mode.ratingLens);
  const moments = bigMomentBonus(input.id, mode.ratingLens);
  const legacy = legacyReputationBonus(input.id);
  const longevity = longevityAdjustment(stats, mode.era);
  const bonus = awards + moments + legacy + longevity;

  // Hand-curated anchors are exact by contract — bonuses would drift a
  // vetted 89 to 92 and defeat the point of anchoring.
  if (!input.manualOvr) {
    clubOvr = clamp(clubOvr + bonus * 0.6);
    intlOvr = clamp(intlOvr + bonus * 0.4);
  }

  let ovr = lensBlend(clubOvr, intlOvr, mode.ratingLens, mode.blendFactor);
  let confidence = input.manualOvr ? 0.98 : statConfidence;

  if (fabricated && !input.manualOvr) {
    ovr = Math.min(ovr, FABRICATED_OVR_CAP);
    confidence = Math.min(confidence, 0.45);
  }

  if (input.manualOvr && mode.ratingLens !== "international_only") {
    ovr = clamp(input.manualOvr);
  }

  const { nudge, entry } = communityCalibrationNudge(input.id, confidence);
  if (!input.manualOvr) ovr = clamp(ovr + nudge);

  return {
    playerId: input.id,
    name: input.name,
    nationality: input.nationality ?? "—",
    position,
    ovr,
    tier: tierFromOvr(ovr),
    fameScore,
    fameTier: fameTierFromScore(fameScore),
    attributes: attrs,
    confidence,
    gkAttributes,
    breakdown: {
      clubOvrRaw: clubOvr,
      intlOvrRaw: intlOvr,
      awardBonus: awards + moments,
      longevityBonus: longevity,
      calibrationNudge: nudge || undefined,
      calibrationReason: entry?.reason,
      lens: mode.ratingLens,
      blendFactor: mode.blendFactor,
      microBreakdown,
      leagueContext,
      fabricated: fabricated || undefined,
      fabricatedCap: fabricated && !input.manualOvr ? FABRICATED_OVR_CAP : undefined,
      ratingBasis: mode.ratingBasis ?? "prime",
      seasonLabel,
      mvBlend: mvBlendPct,
      mvBlendDelta,
      mvBlendWeight,
      legendOverride: input.manualOvr != null || undefined,
    },
  };
}

export function ovrForSeason(input: RatingInput, seasonLabel: string, mode: DraftModeConfig): number {
  return computePlayerRating(
    { ...input, seasonLabel },
    { ...mode, ratingBasis: "season" },
  ).ovr;
}

export function computePool(players: RatingInput[], mode: DraftModeConfig): RatedPlayerCard[] {
  return players.map((p) => computePlayerRating(p, mode)).sort((a, b) => b.ovr - a.ovr);
}
