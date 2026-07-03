import type { Player } from "./types.js";

export interface PlayerSeasonStat {
  playerId: string;
  seasonLabel: string;
  competitionId: string;
  context: "CLUB" | "NATIONAL_TEAM";
  appearances: number;
  goals: number;
  assists: number;
  minutes: number;
  confidence: number;
  shots?: number;
  goalsConceded?: number;
  goalsAgainst?: number;
}

export interface Competition {
  id: string;
  name: string;
  type: string;
  country: string;
}

export interface EraBaseline {
  competitionId: string;
  seasonLabel: string;
  stat: string;
  mean: number;
  stdev: number;
}

export interface ExtendedPlayer extends Player {
  source?: "curated" | "worldcup" | "transfermarkt";
  confidence?: number;
  wcId?: string;
  tmId?: string;
  decades?: string[];
  lastSeason?: number;
}

export interface PlayerAlias {
  curatedId: string;
  tmId: string;
  name: string;
  source: string;
}

export interface PlayerAward {
  playerId: string;
  award: string;
  year: number;
  context: "club" | "international" | "both";
  bonus: number;
}

export interface IconicMoment {
  playerId: string;
  moment: string;
  context: "club" | "international" | "both";
  bonus: number;
}

/** League Strength Index — one row per (league, season) — LSI v1 §7. */
export interface LeagueStrengthIndexEntry {
  competitionId: string;
  seasonLabel: string;
  lsiFinal: number;
  lsiRaw: number;
  confidence: number;
  eloComponent: number;
  transferDeltaComponent: number;
  talentFlowComponent: number;
  natTeamComponent: number;
  crossLeagueFixtures: number;
  transferComparisons: number;
  regionalTierPrior?: number;
}

/** Cross-league continental fixture — feeds Elo component (§1.2). */
export interface CrossLeagueFixture {
  fixtureId: string;
  clubAId: string;
  leagueAId: string;
  clubBId: string;
  leagueBId: string;
  competitionId: string;
  seasonLabel: string;
  /** 1 = A win, 0 = draw, -1 = B win (from A perspective). */
  result: 1 | 0 | -1;
}

/** Player transfer with within-league z deltas — feeds transfer component (§1.3). */
export interface PlayerTransfer {
  playerId: string;
  fromLeagueId: string;
  toLeagueId: string;
  transferSeason: string;
  preMoveZ: number;
  postMoveZ: number;
  ageAtTransfer: number;
  minutesPre: number;
  minutesPost: number;
  roleChangeFlag: boolean;
}

/** Confederation / tournament strength — international lens analogue (§5). */
export interface ConfederationStrengthIndexEntry {
  competitionId: string;
  seasonLabel: string;
  csiFinal: number;
  csiRaw: number;
  confidence: number;
  eloComponent: number;
  transferDeltaComponent: number;
  talentFlowComponent: number;
  natTeamComponent: number;
  crossConfederationFixtures: number;
  transferComparisons: number;
  regionalTierPrior?: number;
}
