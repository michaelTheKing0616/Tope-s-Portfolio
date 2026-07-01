import type { DraftModeConfig, RatedPlayerCard } from "@sportverse/draftballer-types";
import { computePool, type RatingInput } from "@sportverse/rating-engine";
import { getPlayers } from "@sportverse/sports-db";

const LEGEND_OVERRIDES: Record<string, number> = {
  messi: 93,
  ronaldo: 92,
  mbappe: 91,
  haaland: 90,
  "de-bruyne": 91,
  modric: 89,
  benzema: 90,
  lewandowski: 90,
  maldini: 94,
  maradona: 95,
  pele: 96,
  zidane: 94,
  ronaldinho: 93,
  henry: 91,
  "van-dijk": 90,
  salah: 89,
  neymar: 89,
  bellingham: 88,
};

function toRatingInput(p: ReturnType<typeof getPlayers>[number]): RatingInput {
  return {
    id: p.id,
    name: p.name,
    nationality: p.nationality,
    position: p.position,
    clubs: p.clubs,
    manualOvr: LEGEND_OVERRIDES[p.id],
  };
}

export function buildDraftPool(mode: DraftModeConfig): RatedPlayerCard[] {
  let players = getPlayers().map(toRatingInput);

  if (mode.competitionScope === "single_league" && mode.leagueId === "premier-league") {
    const plClubs = new Set([
      "Manchester United",
      "Manchester City",
      "Liverpool",
      "Chelsea",
      "Arsenal",
      "Tottenham Hotspur",
    ]);
    players = players.filter((p) => p.clubs?.some((c) => plClubs.has(c)));
  }

  return computePool(players, mode);
}

export function poolSummary(cards: RatedPlayerCard[]) {
  const byPos: Record<string, number> = {};
  for (const c of cards) byPos[c.position] = (byPos[c.position] ?? 0) + 1;
  return {
    count: cards.length,
    top: cards.slice(0, 10),
    byPosition: byPos,
    avgOvr: cards.length ? Math.round(cards.reduce((s, c) => s + c.ovr, 0) / cards.length) : 0,
  };
}
