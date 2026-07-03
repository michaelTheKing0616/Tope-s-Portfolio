import type { PlayerMetaAttributes, RatedPlayerCard } from "@sportverse/draftballer-types";
import type { PlayerSeasonStat } from "@sportverse/sports-db";

function norm(v: number): number {
  return Math.max(0, Math.min(1, v / 99));
}

function clamp99(n: number): number {
  return Math.max(1, Math.min(99, Math.round(n)));
}

const DURABLE_POS = new Set(["CB", "DM", "GK"]);
const FRAGILE_POS = new Set(["W", "AM"]);

/** Simulation Engine v2 §2.1 — DUR + TRI derived from stats + attributes. */
export function computePlayerMeta(
  player: RatedPlayerCard,
  stats: PlayerSeasonStat[] = [],
  awardBonus = 0,
): PlayerMetaAttributes {
  const { pac, sho, pas, dri, def, phy } = player.attributes;
  const apps = stats.reduce((s, r) => s + r.appearances, 0) || 1;
  const minutes = stats.reduce((s, r) => s + r.minutes, 0);
  const mpg = minutes / apps;

  let durability = 55 + norm(phy) * 25 + norm(def) * 10;
  if (DURABLE_POS.has(player.position)) durability += 8;
  if (FRAGILE_POS.has(player.position)) durability -= 6;
  if (mpg >= 75) durability += 4;
  if (apps >= 200) durability += 5;
  durability = clamp99(durability);

  const tri =
    (norm(dri) + norm(pas)) /
    Math.max(0.01, norm(dri) + norm(pas) + norm(phy) + norm(def));

  const clutchTemperament = clamp99(
    50 + awardBonus * 4 + (player.breakdown.awardBonus ?? 0) * 3 + norm(sho) * 10,
  );

  return {
    playerId: player.playerId,
    durability,
    technicalRelianceIndex: Math.max(0, Math.min(1, tri)),
    clutchTemperament,
  };
}

export function computeSquadMeta(
  players: RatedPlayerCard[],
  statsFor: (id: string) => PlayerSeasonStat[],
): Map<string, PlayerMetaAttributes> {
  const map = new Map<string, PlayerMetaAttributes>();
  for (const p of players) {
    map.set(p.playerId, computePlayerMeta(p, statsFor(p.playerId), p.breakdown.awardBonus));
  }
  return map;
}
