import type { DraftModeConfig, PlayerAttributes, RatedPlayerCard, SimSquadInput } from "./index.js";

export type SimulationMode = "realistic" | "prime_powers";
export type EraContextMode = "custom" | "match_higher_draft" | "neutral_modern" | "historical_recreation";
export type TacticalIdentity = "possession" | "high_press" | "counter" | "route_one" | "balanced";
export type WeatherCondition = "clear" | "rain" | "wind" | "heat" | "random";
export type PitchZone =
  | "def_left"
  | "def_center"
  | "def_right"
  | "mid_left"
  | "mid_center"
  | "mid_right"
  | "att_left"
  | "att_center"
  | "att_right";

export interface EraProfileDimensions {
  physicality_intensity: number;
  tackling_leniency: number;
  pitch_ball_quality: number;
  tactical_sophistication: number;
  tempo: number;
}

export interface EraProfile extends EraProfileDimensions {
  id: string;
  label: string;
  decade?: string;
  competitionId?: string;
  region?: string;
  source?: "curated" | "inferred";
  /** Historical league average total goals per game (both teams) — anchors sim scoring env. */
  goals_per_game?: number;
}

export interface PlayerMetaAttributes {
  playerId: string;
  durability: number;
  technicalRelianceIndex: number;
  clutchTemperament: number;
}

export interface EraContextConfig {
  mode: EraContextMode;
  decadeOrFixtureRef?: string;
  profileId?: string;
}

export interface SimVenueConfig {
  homeAdvantage: boolean;
}

export interface SimMatchConfig {
  simulationMode: SimulationMode;
  eraContext: EraContextConfig;
  tacticalIdentityHome: TacticalIdentity;
  tacticalIdentityAway: TacticalIdentity;
  weather: WeatherCondition;
  venue: SimVenueConfig;
  formationHomeId?: string;
  formationAwayId?: string;
  allowMidmatchFormationChange?: boolean;
  isKnockout?: boolean;
  /** Historical league×season challengers (archive squads). */
  challenger?: { leagueId: string; seasonLabel: string };
}

export const DEFAULT_SIM_CONFIG: SimMatchConfig = {
  simulationMode: "realistic",
  eraContext: { mode: "neutral_modern", profileId: "2020s" },
  tacticalIdentityHome: "balanced",
  tacticalIdentityAway: "balanced",
  weather: "clear",
  venue: { homeAdvantage: false },
  allowMidmatchFormationChange: true,
};

export const PRIME_POWERS_CONFIG: SimMatchConfig = {
  ...DEFAULT_SIM_CONFIG,
  simulationMode: "prime_powers",
};

export interface FitReportLine {
  playerId: string;
  playerName: string;
  baseOvr: number;
  effectiveDelta: number;
  summary: string;
  tags: string[];
}

export interface ZoneOverloadEvent {
  minute: number;
  zone: PitchZone;
  team: "home" | "away";
  overloadDelta: number;
  text: string;
}

export type ExtendedMatchEventType =
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
  | "card_yellow"
  | "card_red"
  | "substitution"
  | "momentum_swing"
  | "fit_commentary"
  | "penalty_goal"
  | "penalty_miss";

export interface ExtendedMatchEvent {
  minute: number;
  type: ExtendedMatchEventType;
  team: "home" | "away";
  playerName?: string;
  text: string;
  /** Hidden chance quality for narrative / UI (not shown as raw xG by default). */
  xg?: number;
}

/** Pre-match synergy pulse for the spectator story. */
export interface MatchSynergyPulse {
  homeScore: number;
  awayScore: number;
  homeHeadline?: string;
  awayHeadline?: string;
}

/** Spectator-facing match pulse — possession / shots / xG from the chance loop. */
export interface MatchPulseStats {
  possessionHome: number;
  possessionAway: number;
  xGHome: number;
  xGAway: number;
  shotsHome: number;
  shotsAway: number;
  bigChancesHome: number;
  bigChancesAway: number;
}

export interface MatchResultV2 {
  homeGoals: number;
  awayGoals: number;
  homeName: string;
  awayName: string;
  events: ExtendedMatchEvent[];
  mvpPlayerId?: string;
  fitReport: FitReportLine[];
  zoneOverloadEvents: ZoneOverloadEvent[];
  momentumFinal: number;
  eraProfileId: string;
  simulationMode: SimulationMode;
  preMatchHeadline?: string;
  penaltyShootout?: { home: number; away: number; winner: "home" | "away" };
  /** Layer 1 Dixon–Coles goal-rate model (Engine v4). */
  goalRateModel?: {
    lambda: number;
    mu: number;
    rho: number;
    targetHomeGoals: number;
    targetAwayGoals: number;
  };
  /** Layer 2 narrative pulse (chance / possession story). */
  matchStats?: MatchPulseStats;
  /** Layer 2 synergy graph summary (links / chemistry feel). */
  synergyPulse?: MatchSynergyPulse;
}

export interface FormationSlotDef {
  slotIndex: number;
  positionTag: string;
  roleTag?: string;
  x: number;
  y: number;
  zoneId: PitchZone;
}

export interface FormationDef {
  id: string;
  name: string;
  backLineCount: number;
  widthCategory: "narrow" | "balanced" | "wide";
  eraTags: string[];
  slots: FormationSlotDef[];
  isCustom?: boolean;
}

export interface SimSquadInputV2 extends SimSquadInput {
  formationId?: string;
  tacticalIdentity?: TacticalIdentity;
  draftMode?: DraftModeConfig;
}

export interface EraLabResultRow {
  eraProfileId: string;
  label: string;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  avgFitDelta: number;
}

export interface EraLabResult {
  squadName: string;
  rows: EraLabResultRow[];
  highlightFit: FitReportLine[];
}

export interface SimulateSquadRequest {
  opponentSquad?: SimSquadInputV2;
  simulationMode?: SimulationMode;
  eraContext?: EraContextConfig;
  tacticalIdentityHome?: TacticalIdentity;
  tacticalIdentityAway?: TacticalIdentity;
  weather?: WeatherCondition;
  venue?: SimVenueConfig;
  formationHome?: string;
  formationAway?: string;
  allowMidmatchFormationChange?: boolean;
}

export interface EffectiveAttributes extends PlayerAttributes {
  ovrEffective: number;
}

export interface PlayerSimState {
  playerId: string;
  fatigueMultiplier: number;
  injured: boolean;
  sentOff: boolean;
  carryFatigue: number;
}
