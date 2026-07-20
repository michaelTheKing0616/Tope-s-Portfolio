import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { __setExtendedDataForTests } from "@sportverse/sports-db";
import {
  attachMvPercentilesFromPeakMv,
  setAwardsData,
  setLegacyReputationData,
  setPartnershipPairs,
  setFameDataForRatings,
  setEaFc26Index,
} from "@sportverse/rating-engine";
import { setLegendRatings } from "@sportverse/draftballer-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)));
const dataDir = resolve(root, "packages/sports-db/data");

const readOptional = (file: string) => {
  try {
    return JSON.parse(readFileSync(resolve(dataDir, file), "utf8"));
  } catch {
    return [];
  }
};

function readSeasonStats() {
  const primary = resolve(dataDir, "season-stats.json");
  const fixture = resolve(dataDir, "season-stats.fixture.json");
  if (existsSync(primary)) {
    return JSON.parse(readFileSync(primary, "utf8"));
  }
  if (existsSync(fixture)) {
    console.warn("[vitest] Using season-stats.fixture.json — run prebuild:data for full test coverage");
    return JSON.parse(readFileSync(fixture, "utf8"));
  }
  return [];
}

const fameFixture = readOptional("fame-index.fixture.json");
const fameFull = readOptional("fame-index.json");
const fameIndex = fameFull.length ? fameFull : fameFixture;

__setExtendedDataForTests({
  players: JSON.parse(readFileSync(resolve(dataDir, "players-extended.json"), "utf8")),
  stats: readSeasonStats(),
  competitions: JSON.parse(readFileSync(resolve(dataDir, "competitions.json"), "utf8")),
  clubs: JSON.parse(readFileSync(resolve(dataDir, "clubs-extended.json"), "utf8")),
  eras: JSON.parse(readFileSync(resolve(dataDir, "era-baselines.json"), "utf8")),
  awards: readOptional("awards.json"),
  moments: readOptional("iconic_moments.json"),
  leagueStrengthIndex: readOptional("league-strength-index.json"),
  confederationStrengthIndex: readOptional("confederation-strength-index.json"),
  crossLeagueFixtures: readOptional("cross-league-fixtures.json"),
  playerTransfers: readOptional("player-transfers.json"),
  fameIndex,
  clubSeasonRosters: readOptional("club-season-rosters.json"),
});

const awards = readOptional("awards.json");
const moments = readOptional("iconic_moments.json");
const legacyRep = readOptional("legacy-reputation.json");
const partnerships = readOptional("partnership-pairs.json");
setAwardsData(awards, moments);
setLegacyReputationData(legacyRep);
setPartnershipPairs(partnerships);
// Fame firewall: MV percentile from peakMv ranks only — never fameScore.
setFameDataForRatings(attachMvPercentilesFromPeakMv(fameIndex));
setLegendRatings(readOptional("legend-ratings.json"));
setEaFc26Index(readOptional("ea-fc26-index.json"));
