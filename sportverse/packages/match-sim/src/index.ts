export { createRng, pickWeighted, type Rng } from "./rng.js";
export { squadStrengths, type SquadStrengths } from "./squad.js";
export { simulateMatch, simulateMatchV2, PRIME_POWERS_CONFIG } from "./match.js";
export { simulateMatchLegacy } from "./match-legacy.js";
export { simulateKnockoutBracket, type KnockoutResult, type KnockoutSquad, type KnockoutOptions } from "./knockout.js";
export { simulateRoundRobin, type RoundRobinTeam, type RoundRobinOptions } from "./round-robin.js";
export { roleFitModifier, assignPlayersToFormationSlots, inferPlayerRole } from "./role-fit.js";
export { selectRotationSubs, applyRotationToSquad } from "./bot-rotation.js";
export { generateOpponents, generateHistoricalOpponents } from "./opponent.js";
export {
  simulateSeason,
  SEASON_LENGTH,
  selectFixtureStoryEvents,
  type SeasonSimOptions,
} from "./season.js";
export { predictSeasonOutlook, gradeSeasonVsPrediction } from "./season-prediction.js";
export { commentaryFor } from "./commentary.js";
export {
  commentaryForV2,
  fitCommentary,
  tacticalPreviewHeadline,
  overloadCommentary,
  tacticalIdentityHint,
} from "./commentary-v2.js";
export {
  buildCommentaryProfile,
  seededGoalCommentary,
  seededChanceCommentary,
  seededSaveCommentary,
  seededCardCommentary,
  seededInjuryCommentary,
  seededFatigueCommentary,
  seededKickoffCommentary,
  seededFulltimeCommentary,
  seededBigChanceCommentary,
  seededFulltimePulseCommentary,
} from "./commentary-seeded.js";
export {
  scheduleGoalMinutes,
  sampleChanceXg,
  summarizeMatchStats,
  chaseIntensity,
} from "./chance-model.js";
export {
  buildSquadSynergy,
  setSimPartnershipPairs,
  synergyChanceBoost,
  type SquadSynergy,
  type SimPartnershipPair,
} from "./synergy-graph.js";
export {
  derivePlayerTraits,
  buildPersonaMap,
  type SimTrait,
  type PlayerMatchPersona,
} from "./player-traits.js";
export { resolveSetPiece, shouldTriggerSetPiece, pickSetPieceKind } from "./set-piece.js";
export { listEraProfiles, getEraProfile, resolveEraProfile, resolveEraFromSeasonLabel, eraProfileIdFromSeasonLabel, ERA_PROFILES } from "./era-profiles.js";
export { computePlayerMeta, computeSquadMeta } from "./player-meta.js";
export {
  computePhysicalityFitTerm,
  computeAnachronismTerm,
  playerPeakEraId,
  buildFitSummary,
  computeSquadFitReport,
  squadAveragePhysicalityFit,
  fitPreviewHeadline,
} from "./fit-model.js";
export {
  FORMATIONS,
  getFormation,
  listFormations,
  zonePresence,
  zoneOverloadModifier,
  zoneOverloadModifier as computeZoneModifier,
  formationsForEra,
} from "./formations.js";
export { simulateEraLab } from "./era-lab.js";
export { resolveWeather } from "./weather.js";
export {
  computeDixonColesRates,
  sampleDixonColesScore,
  buildScoreDistribution,
  dixonColesTimeDecayWeight,
  DEFAULT_RHO,
} from "./dixon-coles.js";
export { computeMatchGoalRates, eraGoalsPerGameScale, squadGoalRateFloor } from "./match-rates.js";
export { computeIntelligentMatchRates, styleClashBias } from "./match-intelligence.js";
export {
  fitAggregationBridge,
  DEFAULT_BRIDGE_COEFFICIENTS,
  bridgeCalibrationMae,
  bridgeCoefficientsHealthy,
  getBridgeCoefficients,
} from "./aggregation-bridge.js";
export { squadStrengthSignals } from "./team-strength.js";
export {
  rankedProbabilityScore,
  brierScore,
  logLoss,
  buildValidationReport,
  outcomeProbabilitiesFromScoreMatrix,
  SOCcer_PREDICTION_CHALLENGE_2017_BENCHMARK,
} from "./validation.js";
export type { SimulateMatchOptions } from "./sim-engine.js";
