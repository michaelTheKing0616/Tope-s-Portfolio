import type { RatedPlayerCard, SimSquadInput } from "@sportverse/draftballer-types";
import { createRng } from "./rng.js";

const FORMATION: RatedPlayerCard["position"][] = ["GK", "CB", "CB", "FB", "FB", "CM", "CM", "AM", "W", "W", "ST"];

const FALLBACK_NAMES = [
  "North United",
  "Riverside FC",
  "Metro Athletic",
  "Coastal Wanderers",
  "Iron Borough",
  "Summit Town",
  "Harbour City",
  "Valley Rovers",
  "Capital Dynamo",
  "Forest Albion",
  "Meridian SC",
  "Thunder Lane",
  "Crystal Vale",
  "Granite Works",
  "Silverfield",
  "Eastgate",
  "Westmoor",
  "Highland FC",
  "Dockside",
  "Parkview",
];

function synthesizeOpponentPlayers(ovr: number, seed: string, rng: ReturnType<typeof createRng>): RatedPlayerCard[] {
  const positions = FORMATION;
  return positions.map((position, i) => {
    const jitter = (rng() - 0.5) * 8;
    const playerOvr = Math.max(50, Math.min(99, Math.round(ovr + jitter)));
    const base = playerOvr - 5;
    return {
      playerId: `opp_${seed}_${i}`,
      name: `Opponent ${i + 1}`,
      nationality: "—",
      position,
      ovr: playerOvr,
      tier: playerOvr >= 90 ? "prismatic" : playerOvr >= 85 ? "gold_plus" : playerOvr >= 75 ? "gold" : playerOvr >= 65 ? "silver" : "bronze",
      attributes: {
        pac: base + 2,
        sho: base + (position === "ST" || position === "W" ? 6 : 0),
        pas: base + (position === "CM" || position === "AM" ? 5 : 0),
        dri: base + 3,
        def: base + (position === "CB" || position === "GK" ? 8 : 0),
        phy: base + 4,
      },
      confidence: 0.5,
      breakdown: {
        clubOvrRaw: playerOvr,
        intlOvrRaw: playerOvr - 3,
        awardBonus: 0,
        lens: "club_only",
        blendFactor: 0,
      },
    };
  });
}

function buildRivalFromPool(
  targetOvr: number,
  seed: string,
  pool: RatedPlayerCard[],
  rng: ReturnType<typeof createRng>,
  index: number,
): SimSquadInput {
  const shuffled = [...pool].sort((a, b) => {
    const da = Math.abs(a.ovr - targetOvr);
    const db = Math.abs(b.ovr - targetOvr);
    if (da !== db) return da - db;
    return rng() - 0.5;
  });

  const picked: RatedPlayerCard[] = [];
  const used = new Set<string>();

  for (const pos of FORMATION) {
    const match =
      shuffled.find((p) => p.position === pos && !used.has(p.playerId)) ??
      shuffled.find((p) => !used.has(p.playerId));
    if (match) {
      picked.push(match);
      used.add(match.playerId);
    }
  }

  if (picked.length < 11) {
    const synth = synthesizeOpponentPlayers(targetOvr, seed, rng);
    while (picked.length < 11) picked.push(synth[picked.length]!);
  }

  const squadOvr = Math.round(picked.reduce((s, p) => s + p.ovr, 0) / picked.length);
  const lead = picked.sort((a, b) => b.ovr - a.ovr)[0];
  const clubHint = lead?.name?.split(" ").pop() ?? FALLBACK_NAMES[index % FALLBACK_NAMES.length];

  return {
    name: `${clubHint} XI (${squadOvr} OVR)`,
    playerIds: picked.map((p) => p.playerId),
    squadOvr,
    players: picked,
  };
}

/** Generate opponent squads scaled to user OVR — uses real player pool when provided. */
export function generateOpponents(
  userSquad: SimSquadInput,
  count: number,
  seed: string,
  rivalPool?: RatedPlayerCard[],
): SimSquadInput[] {
  const rng = createRng(`${seed}:opponents`);
  const baseOvr = userSquad.squadOvr;
  const pool = rivalPool?.length ? rivalPool : [];

  return Array.from({ length: count }, (_, i) => {
    const variance = (rng() - 0.5) * 14;
    const difficulty = Math.sin((i / count) * Math.PI) * 4;
    const targetOvr = Math.max(58, Math.min(96, Math.round(baseOvr + variance + difficulty - 2)));

    if (pool.length >= 22) {
      const offset = Math.floor(rng() * Math.max(1, pool.length - 22));
      const slice = pool.slice(offset, offset + 120);
      return buildRivalFromPool(targetOvr, `${seed}:opp${i}`, slice.length ? slice : pool, rng, i);
    }

    return {
      name: `${FALLBACK_NAMES[i % FALLBACK_NAMES.length]} (${targetOvr} OVR)`,
      playerIds: [],
      squadOvr: targetOvr,
      players: synthesizeOpponentPlayers(targetOvr, `${seed}:opp${i}`, rng),
    };
  });
}