export type Position = "GK" | "CB" | "FB" | "DM" | "CM" | "AM" | "W" | "ST";

export type RatingTier = "bronze" | "silver" | "gold" | "gold_plus" | "prismatic";

export type EraFilter = "single_year" | "decade" | "all_time" | "custom_range";
export type CompetitionScope = "single_league" | "any_league" | "continental" | "international" | "custom";
export type RatingLens = "club_only" | "international_only" | "blended" | "best_context";

export interface DraftModeConfig {
  id: string;
  title: string;
  blurb: string;
  era: EraFilter;
  competitionScope: CompetitionScope;
  ratingLens: RatingLens;
  blendFactor: number;
  leagueId?: string;
  year?: number;
  decade?: string;
}

export interface PlayerAttributes {
  pac: number;
  sho: number;
  pas: number;
  dri: number;
  def: number;
  phy: number;
}

export interface RatedPlayerCard {
  playerId: string;
  name: string;
  nationality: string;
  position: Position;
  ovr: number;
  tier: RatingTier;
  attributes: PlayerAttributes;
  confidence: number;
  breakdown: {
    clubOvrRaw: number;
    intlOvrRaw: number;
    awardBonus: number;
    lens: RatingLens;
    blendFactor: number;
  };
}

export interface DraftPick {
  round: number;
  pickInRound: number;
  drafterIndex: number;
  playerId: string;
  playerName: string;
  ovr: number;
}

export type DraftFormat = "snake" | "linear";

export interface DraftRoomState {
  id: string;
  mode: DraftModeConfig;
  format: DraftFormat;
  drafterCount: number;
  squadSize: number;
  currentPickIndex: number;
  picks: DraftPick[];
  rosters: string[][];
  poolIds: string[];
  status: "lobby" | "picking" | "complete";
}
