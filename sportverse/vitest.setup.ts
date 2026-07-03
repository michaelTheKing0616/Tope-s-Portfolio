import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { __setExtendedDataForTests } from "@sportverse/sports-db";
import { setAwardsData, setLegacyReputationData, setPartnershipPairs } from "@sportverse/rating-engine";

const root = resolve(dirname(fileURLToPath(import.meta.url)));
const dataDir = resolve(root, "packages/sports-db/data");

const readOptional = (file: string) => {
  try {
    return JSON.parse(readFileSync(resolve(dataDir, file), "utf8"));
  } catch {
    return [];
  }
};

__setExtendedDataForTests({
  players: JSON.parse(readFileSync(resolve(dataDir, "players-extended.json"), "utf8")),
  stats: JSON.parse(readFileSync(resolve(dataDir, "season-stats.json"), "utf8")),
  competitions: JSON.parse(readFileSync(resolve(dataDir, "competitions.json"), "utf8")),
  clubs: JSON.parse(readFileSync(resolve(dataDir, "clubs-extended.json"), "utf8")),
  eras: JSON.parse(readFileSync(resolve(dataDir, "era-baselines.json"), "utf8")),
  awards: readOptional("awards.json"),
  moments: readOptional("iconic_moments.json"),
  leagueStrengthIndex: readOptional("league-strength-index.json"),
  confederationStrengthIndex: readOptional("confederation-strength-index.json"),
  crossLeagueFixtures: readOptional("cross-league-fixtures.json"),
  playerTransfers: readOptional("player-transfers.json"),
});

const awards = readOptional("awards.json");
const moments = readOptional("iconic_moments.json");
const legacyRep = readOptional("legacy-reputation.json");
const partnerships = readOptional("partnership-pairs.json");
setAwardsData(awards, moments);
setLegacyReputationData(legacyRep);
setPartnershipPairs(partnerships);
