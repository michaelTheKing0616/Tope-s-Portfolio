export { createRng, pickWeighted, type Rng } from "./rng.js";
export { squadStrengths, type SquadStrengths } from "./squad.js";
export { simulateMatch, simulateMatchV2, PRIME_POWERS_CONFIG } from "./match.js";
export { simulateMatchLegacy } from "./match-legacy.js";
export { simulateKnockoutBracket, type KnockoutResult, type KnockoutSquad, type KnockoutOptions } from "./knockout.js";
export { simulateRoundRobin, type RoundRobinTeam, type RoundRobinOptions } from "./round-robin.js";
export { roleFitModifier, assignPlayersToFormationSlots, inferPlayerRole } from "./role-fit.js";
export { selectRotationSubs, applyRotationToSquad } from "./bot-rotation.js";
export { generateOpponents } from "./opponent.js";
export { simulateSeason, SEASON_LENGTH } from "./season.js";
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
} from "./commentary-seeded.js";
export { listEraProfiles, getEraProfile, resolveEraProfile, ERA_PROFILES } from "./era-profiles.js";
export { computePlayerMeta, computeSquadMeta } from "./player-meta.js";
export {
  computePhysicalityFitTerm,
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
export { computeMatchGoalRates, eraGoalsPerGameScale } from "./match-rates.js";
export { fitAggregationBridge, DEFAULT_BRIDGE_COEFFICIENTS, bridgeCalibrationMae } from "./aggregation-bridge.js";
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
