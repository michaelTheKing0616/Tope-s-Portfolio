import type {
  DraftModeConfig,
  PlayerAttributes,
  RatedPlayerCard,
} from "@sportverse/draftballer-types";
import { mapQuizPosition, ovrFromAttributes, tierFromOvr } from "./position-weights.js";

export interface RatingInput {
  id: string;
  name: string;
  nationality?: string;
  position?: string;
  clubs?: string[];
  /** Optional hand-tuned override for verified legends */
  manualOvr?: number;
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

function clamp(n: number, min = 1, max = 99): number {
  return Math.max(min, Math.min(max, Math.round(n)));
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

function lensBlend(clubOvr: number, intlOvr: number, lens: DraftModeConfig["ratingLens"], blend: number): number {
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

/** Compute OVR for a player under the given draft mode config. */
export function computePlayerRating(input: RatingInput, mode: DraftModeConfig): RatedPlayerCard {
  const position = mapQuizPosition(input.position);
  const attrs = deriveAttributes(input, position);
  const clubOvr = input.manualOvr ?? ovrFromAttributes(position, attrs);
  const intlOvr = clamp(clubOvr - 4 + (seeded(`${input.id}:intl`)() > 0.6 ? 6 : 0));
  const ovr = lensBlend(clubOvr, intlOvr, mode.ratingLens, mode.blendFactor);

  return {
    playerId: input.id,
    name: input.name,
    nationality: input.nationality ?? "—",
    position,
    ovr,
    tier: tierFromOvr(ovr),
    attributes: attrs,
    confidence: input.manualOvr ? 0.98 : 0.72,
    breakdown: {
      clubOvrRaw: clubOvr,
      intlOvrRaw: intlOvr,
      awardBonus: 0,
      lens: mode.ratingLens,
      blendFactor: mode.blendFactor,
    },
  };
}

export function computePool(players: RatingInput[], mode: DraftModeConfig): RatedPlayerCard[] {
  return players.map((p) => computePlayerRating(p, mode)).sort((a, b) => b.ovr - a.ovr);
}
