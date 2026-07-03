import type {
  DraftModeConfig,
  PlayerAttributes,
  RatedPlayerCard,
} from "@sportverse/draftballer-types";
import type { PlayerSeasonStat } from "@sportverse/sports-db";
import { mapQuizPosition, ovrFromAttributes, tierFromOvr } from "./position-weights.js";
import { ovrFromSeasonStats } from "./stats-rating.js";
import { lensBlend } from "./lens-blend.js";
import { awardBonus, bigMomentBonus, legacyReputationBonus, longevityAdjustment } from "./awards.js";
import { communityCalibrationNudge } from "./calibration.js";

export interface RatingInput {
  id: string;
  name: string;
  nationality?: string;
  position?: string;
  clubs?: string[];
  seasonStats?: PlayerSeasonStat[];
  /** Optional hand-tuned override for verified legends */
  manualOvr?: number;
}

function clamp(n: number, min = 1, max = 99): number {
  return Math.max(min, Math.min(max, Math.round(n)));
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

function deriveAttributes(input: RatingInput, position: ReturnType<typeof mapQuizPosition>): PlayerAttributes {
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

  return {
    pac: clamp(base + (bump.pac ?? 0) + jitter()),
    sho: clamp(base + (bump.sho ?? 0) + jitter()),
    pas: clamp(base + (bump.pas ?? 0) + jitter()),
    dri: clamp(base + (bump.dri ?? 0) + jitter()),
    def: clamp(base + (bump.def ?? 0) + jitter()),
    phy: clamp(base + (bump.phy ?? 0) + jitter()),
  };
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

function ratingFromStats(
  stats: PlayerSeasonStat[] | undefined,
  position: ReturnType<typeof mapQuizPosition>,
  mode: DraftModeConfig,
  context: "club" | "intl",
) {
  if (!stats?.length) return null;
  return ovrFromSeasonStats(
    stats,
    position,
    contextMode(mode, context),
    context === "intl" ? "international" : "club",
  );
}

/** Compute OVR for a player under the given draft mode config (rating engine v4). */
export function computePlayerRating(input: RatingInput, mode: DraftModeConfig): RatedPlayerCard {
  const position = mapQuizPosition(input.position);
  const stats = input.seasonStats ?? [];

  const clubFromStats = ratingFromStats(stats, position, mode, "club");
  const intlFromStats = ratingFromStats(stats, position, mode, "intl");

  const attrs = clubFromStats?.attrs ?? intlFromStats?.attrs ?? deriveAttributes(input, position);
  const statConfidence = Math.max(clubFromStats?.confidence ?? 0, intlFromStats?.confidence ?? 0, 0.72);
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

  const awards = awardBonus(input.id, mode.ratingLens);
  const moments = bigMomentBonus(input.id, mode.ratingLens);
  const legacy = legacyReputationBonus(input.id);
  const longevity = longevityAdjustment(stats, mode.era);
  const bonus = awards + moments + legacy + longevity;

  clubOvr = clamp(clubOvr + bonus * 0.6);
  intlOvr = clamp(intlOvr + bonus * 0.4);

  let ovr = lensBlend(clubOvr, intlOvr, mode.ratingLens, mode.blendFactor);
  const confidence = input.manualOvr ? 0.98 : statConfidence;
  const { nudge, entry } = communityCalibrationNudge(input.id, confidence);
  ovr = clamp(ovr + nudge);

  return {
    playerId: input.id,
    name: input.name,
    nationality: input.nationality ?? "—",
    position,
    ovr,
    tier: tierFromOvr(ovr),
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
    },
  };
}

export function computePool(players: RatingInput[], mode: DraftModeConfig): RatedPlayerCard[] {
  return players.map((p) => computePlayerRating(p, mode)).sort((a, b) => b.ovr - a.ovr);
}
