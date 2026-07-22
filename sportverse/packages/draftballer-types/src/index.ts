export type Position = "GK" | "CB" | "FB" | "DM" | "CM" | "AM" | "W" | "ST";

export type RatingTier = "bronze" | "silver" | "gold" | "gold_plus" | "prismatic";

export type EraFilter = "single_year" | "decade" | "all_time" | "custom_range";
export type CompetitionScope = "single_league" | "any_league" | "continental" | "international" | "custom";
export type RatingLens = "club_only" | "international_only" | "blended" | "best_context";
export type RatingBasis = "prime" | "season" | "ea_current";
export type FameTier = "icon" | "star" | "known" | "cult" | "obscure";
export type DraftOrderMode = "squad_first" | "position_first";
export type DraftDifficulty = "easy" | "normal" | "hard";

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
  /** When true, skip cross-league LSI bridging (Raw Domestic Dominance toggle — §6.1). */
  rawDomesticDominance?: boolean;
  /** Custom era window (inclusive season labels as years). */
  yearFrom?: number;
  yearTo?: number;
  /** Multi-league filter when competitionScope is `custom`. */
  leagueIds?: string[];
  /** Peak-N only — ignore non-peak seasons in all-time/decade modes. */
  primeYearsOnly?: boolean;
  /** Enforce position-locked picks in draft rooms. */
  positionLocked?: boolean;
  /** Rate players at career peak or specific season context. */
  ratingBasis?: RatingBasis;
  /** Include low-confidence fabricated ratings (hipster mode). */
  deepCuts?: boolean;
  /** Squad-first vs position-first wheel draft. */
  draftOrder?: DraftOrderMode;
  /** Easy / normal / hard — controls rerolls and blind mode defaults. */
  difficulty?: DraftDifficulty;
  /** Hide OVR during draft (trust your gut). */
  blindRatings?: boolean;
  /** Formation id from match-sim (default 4-3-3). */
  formationId?: string;
}

export interface PlayerAttributes {
  pac: number;
  sho: number;
  pas: number;
  dri: number;
  def: number;
  phy: number;
}

/** GK-specific attributes — DIV/HAN/KIC/REF/SPD/POS (Rating Engine v3 EA addendum). */
export interface GKAttributes {
  div: number;
  han: number;
  kic: number;
  ref: number;
  spd: number;
  pos: number;
}

export interface RatedPlayerCard {
  playerId: string;
  name: string;
  nationality: string;
  position: Position;
  ovr: number;
  tier: RatingTier;
  fameScore: number;
  fameTier: FameTier;
  attributes: PlayerAttributes;
  confidence: number;
  /** Card context line e.g. "Henry · Arsenal · 2003-04" */
  contextLine?: string;
  hookLine?: string;
  breakdown: {
    clubOvrRaw: number;
    intlOvrRaw: number;
    awardBonus: number;
    longevityBonus?: number;
    calibrationNudge?: number;
    calibrationReason?: string;
    lens: RatingLens;
    blendFactor: number;
    microBreakdown?: Partial<Record<keyof PlayerAttributes, Record<string, number>>>;
    squadRatingBreakdown?: {
      correctionFactor: number;
      chemistryBonus: number;
      zoneCoherenceBonus: number;
    };
    leagueContext?: {
      competitionId: string;
      seasonLabel: string;
      strengthIndex: number;
      confidence: number;
      confidenceLabel: string;
      pointSwing: number;
      scalingFactor: number;
      baselineShift: number;
      skipped?: boolean;
      skipReason?: string;
      lens: "club" | "international";
    };
    fabricated?: boolean;
    /** Cap applied when attributes are role-archetype estimates (currently 72). */
    fabricatedCap?: number;
    ratingBasis?: RatingBasis;
    seasonLabel?: string;
    /** Era-normalized peak market-value percentile (0–100). Display / audit only alongside delta. */
    mvBlend?: number;
    /** OVR points contributed by the labeled MV scouting-consensus blend (after round). */
    mvBlendDelta?: number;
    /** Weight used in MV blend (0.2 outfield / 0.15 GK). */
    mvBlendWeight?: number;
    /** True when OVR came from legend-ratings.json manual override. */
    legendOverride?: boolean;
    /** EA FC 26 current-season calibrated OVR (external reference). */
    eaCalibrationOvr?: number;
    /** Points stats peak exceeded EA current snapshot (prime uplift signal). */
    eaPeakUplift?: number;
    /** Prime-era bump above EA current snapshot (all-time modes). */
    eaPrimeUplift?: number;
    /** SoFIFA / tier-2 historical peak anchor applied as floor. */
    historicalPeakOvr?: number;
    historicalUplift?: number;
    historicalPrimeUplift?: number;
    historicalSource?: string;
  };
  gkAttributes?: GKAttributes;
}

export interface DraftPick {
  round: number;
  pickInRound: number;
  drafterIndex: number;
  playerId: string;
  playerName: string;
  ovr: number;
}

export type DraftFormat = "snake" | "linear" | "auction" | "blind";

export interface AuctionLotState {
  playerId: string;
  playerName: string;
  ovr: number;
  nominatorIndex: number;
  highBid: number;
  highBidder: number | null;
  status: "open" | "resolved";
}

export interface BlindRoundState {
  round: number;
  submissions: { drafterIndex: number; playerId: string; playerName: string; ovr: number }[];
  complete: boolean;
}

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
  /** Auction format — remaining budget per drafter (defaults to squadSize × 100). */
  budgets?: number[];
  auctionLot?: AuctionLotState | null;
  /** Blind format — simultaneous picks per round. */
  blindRound?: BlindRoundState | null;
}

/** One slice on the spin wheel — club+season (38-0 style) or nationality+era. */
export interface WheelSegment {
  id: string;
  label: string;
  sublabel: string;
  club?: string;
  clubId?: string;
  seasonLabel?: string;
  nationality?: string;
  eraLabel?: string;
  fameSum?: number;
  squadPlayerIds?: string[];
}

export interface FormationSlot {
  id: string;
  position: Position;
  playerId?: string;
}

export type WheelPhase = "ready" | "spinning" | "picking" | "complete";

/** Spin-and-build session (38-0 style randomizer draft). */
export interface WheelBuildState {
  mode: DraftModeConfig;
  seed: string;
  segments: WheelSegment[];
  formation: FormationSlot[];
  roster: string[];
  currentSlotIndex: number;
  spunSegment: WheelSegment | null;
  phase: WheelPhase;
  spinsUsed: number;
  squadSize: number;
  rerollsLeft: number;
  seenPlayerIds: string[];
  candidateIds: string[];
  fallback?: "respin_free" | "out_of_position" | null;
  selectedSlotIndex?: number;
  /** Cache key of the slot the current segments were built for (position-aware wheel). */
  segmentsSlotKey?: string;
}

/** Squad input for match/season simulation (bible §7.1). */
export interface SimSquadInput {
  name?: string;
  playerIds: string[];
  players: RatedPlayerCard[];
  squadOvr: number;
}

export type MatchEventType =
  | "goal"
  | "shot_saved"
  | "chance_missed"
  | "big_chance"
  | "corner"
  | "free_kick"
  | "set_piece_chance"
  | "synergy"
  | "kickoff"
  | "fulltime"
  | "momentum_swing"
  | "card_yellow"
  | "card_red";

export interface MatchEvent {
  minute: number;
  type: MatchEventType;
  team: "home" | "away";
  playerName?: string;
  text: string;
  xg?: number;
}

export interface MatchResult {
  homeGoals: number;
  awayGoals: number;
  homeName: string;
  awayName: string;
  events: MatchEvent[];
  mvpPlayerId?: string;
}

export interface FixtureResult {
  matchday: number;
  opponent: string;
  home: boolean;
  goalsFor: number;
  goalsAgainst: number;
  result: "W" | "D" | "L";
  events: MatchEvent[];
}

export interface SeasonSimResult {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  fixtures: FixtureResult[];
  mvpPlayerId?: string;
  mvpPlayerName?: string;
  isUnbeaten: boolean;
  isPerfect: boolean;
  seed: string;
  chemistry?: number;
  areaRatings?: { att: number; mid: number; def: number; gk: number; chem: number };
  teamIdentity?: string;
  notableResults?: { opponent: string; score: string; headline: string }[];
  /** Pre-sim layman preview shown before the engine runs. */
  prediction?: SeasonPrediction;
  /** Post-sim comparison of actual vs predicted. */
  expectationGrade?: SeasonExpectationGrade;
  /** Aggregated / era-preview Fit Report for the user's XI. */
  seasonFitReport?: import("./sim-types.js").FitReportLine[];
  /** Era profile id used for this season sim (seed discipline). */
  eraProfileId?: string;
}

/** Superficial pre-sim forecast from raw squad OVR (pundit-style). */
export interface SeasonPrediction {
  expectedWins: number;
  expectedDraws: number;
  expectedLosses: number;
  expectedPoints: number;
  expectedGoalsFor: number;
  expectedGoalsAgainst: number;
  expectedGoalDifference: number;
  squadOvr: number;
  avgXiOvr: number;
  opponentAvgOvr: number;
  starPlayerName?: string;
  starPlayerOvr?: number;
  outlookTier:
    | "title_challenger"
    | "european_push"
    | "mid_table"
    | "survival_scrap"
    | "relegation_battle";
  headline: string;
  narrative: string;
  disclaimer: string;
}

export type ExpectationGradeCode =
  | "exceeded"
  | "overperformed"
  | "met"
  | "slightly_above"
  | "slightly_below"
  | "underperformed"
  | "underwhelmed";

/** Post-season verdict vs pre-sim prediction. */
export interface SeasonExpectationGrade {
  grade: ExpectationGradeCode;
  label: string;
  summary: string;
  pointsDelta: number;
  goalDifferenceDelta: number;
  winsDelta: number;
  prediction: SeasonPrediction;
  actualPoints: number;
  actualRecord: string;
}

/** Persisted squad payload for season sim route. */
export interface SavedSquadPayload {
  mode: DraftModeConfig;
  playerIds: string[];
  squadOvr: number;
  source: "wheel" | "snake" | "linear" | "auction" | "blind" | "mp" | "challenge";
  formationId?: string;
  seed?: string;
  tacticalIdentity?: import("./sim-types.js").TacticalIdentity;
  /** Simulation era choice from Match Conditions (Phase 2). */
  eraContext?: import("./sim-types.js").EraContextConfig;
  /** `realistic` = era fit ON; `prime_powers` = raw OVR. */
  simulationMode?: import("./sim-types.js").SimulationMode;
  seasonResult?: Pick<SeasonSimResult, "won" | "drawn" | "lost" | "points" | "teamIdentity">;
}

export interface RoundRobinFixture {
  matchday: number;
  homeTeamId: string;
  awayTeamId: string;
  homeName: string;
  awayName: string;
  homeGoals: number;
  awayGoals: number;
  events: MatchEvent[];
}

export interface RoundRobinStanding {
  teamId: string;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  goalDifference: number;
}

export interface RoundRobinResult {
  fixtures: RoundRobinFixture[];
  standings: RoundRobinStanding[];
  championTeamId: string;
  championName: string;
  seed: string;
}

export * from "./sim-types.js";
