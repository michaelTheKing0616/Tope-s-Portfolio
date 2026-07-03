import type {
  ConfederationStrengthIndexEntry,
  CrossLeagueFixture,
  LeagueStrengthIndexEntry,
  PlayerTransfer,
} from "./extended-types.js";
import { resolveCompetitionToLeague } from "./league-resolver.js";

let leagueStrengthIndex: LeagueStrengthIndexEntry[] = [];
let confederationStrengthIndex: ConfederationStrengthIndexEntry[] = [];
let crossLeagueFixtures: CrossLeagueFixture[] = [];
let playerTransfers: PlayerTransfer[] = [];

const lsiKey = (competitionId: string, seasonLabel: string) => `${competitionId}::${seasonLabel}`;
const lsiMap = new Map<string, LeagueStrengthIndexEntry>();
const csiMap = new Map<string, ConfederationStrengthIndexEntry>();

function rebuildMaps(): void {
  lsiMap.clear();
  for (const row of leagueStrengthIndex) lsiMap.set(lsiKey(row.competitionId, row.seasonLabel), row);
  csiMap.clear();
  for (const row of confederationStrengthIndex) csiMap.set(lsiKey(row.competitionId, row.seasonLabel), row);
}

function nearestSeason(rows: LeagueStrengthIndexEntry[], competitionId: string, seasonLabel: string) {
  const sameLeague = rows.filter((r) => r.competitionId === competitionId);
  if (!sameLeague.length) return null;
  const numeric = Number(seasonLabel);
  if (Number.isFinite(numeric)) {
    return sameLeague.reduce((best, row) => {
      const d = Math.abs(Number(row.seasonLabel) - numeric);
      const bestD = Math.abs(Number(best.seasonLabel) - numeric);
      return d < bestD ? row : best;
    });
  }
  return sameLeague.sort((a, b) => b.seasonLabel.localeCompare(a.seasonLabel))[0] ?? null;
}

export function setLeagueStrengthData(data: {
  leagueStrengthIndex?: LeagueStrengthIndexEntry[];
  confederationStrengthIndex?: ConfederationStrengthIndexEntry[];
  crossLeagueFixtures?: CrossLeagueFixture[];
  playerTransfers?: PlayerTransfer[];
}): void {
  leagueStrengthIndex = data.leagueStrengthIndex ?? leagueStrengthIndex;
  confederationStrengthIndex = data.confederationStrengthIndex ?? confederationStrengthIndex;
  crossLeagueFixtures = data.crossLeagueFixtures ?? crossLeagueFixtures;
  playerTransfers = data.playerTransfers ?? playerTransfers;
  rebuildMaps();
}

export function getLeagueStrengthIndex(
  competitionId: string,
  seasonLabel: string,
): LeagueStrengthIndexEntry | null {
  const leagueId = resolveCompetitionToLeague(competitionId) ?? competitionId;
  return (
    lsiMap.get(lsiKey(leagueId, seasonLabel)) ??
    nearestSeason(leagueStrengthIndex, leagueId, seasonLabel) ??
    lsiMap.get(lsiKey(leagueId, "2020")) ??
    null
  );
}

export function getConfederationStrengthIndex(
  competitionId: string,
  seasonLabel: string,
): ConfederationStrengthIndexEntry | null {
  return (
    csiMap.get(lsiKey(competitionId, seasonLabel)) ??
    csiMap.get(lsiKey(competitionId, "2022")) ??
    null
  );
}

export function getCrossLeagueFixtures(): CrossLeagueFixture[] {
  return crossLeagueFixtures;
}

export function getPlayerTransfers(): PlayerTransfer[] {
  return playerTransfers;
}

export function getAllLeagueStrengthIndex(): LeagueStrengthIndexEntry[] {
  return leagueStrengthIndex;
}

export function getAllConfederationStrengthIndex(): ConfederationStrengthIndexEntry[] {
  return confederationStrengthIndex;
}

/** Confidence label for explainability panel (§6). */
export function lsiConfidenceLabel(confidence: number, fixtures: number, transfers: number): string {
  const tier = confidence >= 0.85 ? "high" : confidence >= 0.65 ? "medium" : "low";
  return `${tier} confidence, based on ${fixtures} cross-league fixtures and ${transfers} transfer comparisons`;
}
