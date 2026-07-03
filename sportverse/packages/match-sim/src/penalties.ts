import type { PlayerMetaAttributes, SimSquadInput } from "@sportverse/draftballer-types";
import type { Rng } from "./rng.js";

export function simulatePenaltyShootout(
  home: SimSquadInput,
  away: SimSquadInput,
  rng: Rng,
  homeMeta: PlayerMetaAttributes[],
  awayMeta: PlayerMetaAttributes[],
): { home: number; away: number; winner: "home" | "away" } {
  let homePens = 0;
  let awayPens = 0;
  const rounds = 5;
  for (let i = 0; i < rounds; i++) {
    homePens += takePenalty(home, homeMeta, rng) ? 1 : 0;
    awayPens += takePenalty(away, awayMeta, rng) ? 1 : 0;
  }
  while (homePens === awayPens) {
    homePens += takePenalty(home, homeMeta, rng) ? 1 : 0;
    awayPens += takePenalty(away, awayMeta, rng) ? 1 : 0;
  }
  return { home: homePens, away: awayPens, winner: homePens > awayPens ? "home" : "away" };
}

function takePenalty(squad: SimSquadInput, meta: PlayerMetaAttributes[], rng: Rng): boolean {
  const takers = squad.players.filter((p) => ["ST", "AM", "CM", "W"].includes(p.position));
  const taker = takers[Math.floor(rng() * Math.max(1, takers.length))] ?? squad.players[0]!;
  const m = meta.find((x) => x.playerId === taker.playerId);
  const composure = ((m?.clutchTemperament ?? 60) + taker.attributes.sho) / 2;
  const gk = squad.players.find((p) => p.position === "GK");
  const gkSave = gk ? gk.attributes.def * 0.4 + gk.attributes.phy * 0.3 : 55;
  const scoreProb = 1 / (1 + Math.exp(-(composure - gkSave) / 12));
  return rng() < scoreProb;
}
