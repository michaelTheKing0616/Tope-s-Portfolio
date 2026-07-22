import type { RatedPlayerCard, SimSquadInput } from "@sportverse/draftballer-types";
import { clubDisplayName, listSimClubSeasons, type ClubSeasonKey } from "@sportverse/sports-db";
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

/**
 * League-structured opponents: 19 rival clubs faced twice each (like a real
 * league), tiered from title rivals to minnows. Rival quality anchors mostly
 * to a realistic league mean (74) with a partial pull toward the user's OVR,
 * so elite drafts get title races and weak drafts get relegation scraps —
 * but a great XI can actually put four past the bottom side.
 */
export function generateOpponents(
  userSquad: SimSquadInput,
  count: number,
  seed: string,
  rivalPool?: RatedPlayerCard[],
): SimSquadInput[] {
  const rng = createRng(`${seed}:opponents`);
  const pool = rivalPool?.length ? rivalPool : [];
  const leagueMean = 0.35 * userSquad.squadOvr + 0.65 * 74;

  // Tier offsets vs league mean — a believable 20-club pyramid.
  const tierOffsets = [
    9, 7,               // title rivals
    5, 4, 3, 2,         // European chasers
    1, 0, 0, -1, -1, -2, -3, // mid-table
    -4, -5, -6, -7,     // strugglers
    -9, -11,            // minnows
  ];
  const clubCount = Math.max(1, Math.ceil(count / 2));
  // Rotate the tier wheel so short runs (H2H, Era Lab) sample a random tier
  // instead of always drawing the title rival; full 19-club seasons keep the
  // same pyramid regardless of rotation.
  const rotation = Math.floor(rng() * tierOffsets.length);
  const targets: number[] = [];
  for (let i = 0; i < clubCount; i++) {
    const offset = tierOffsets[(i + rotation) % tierOffsets.length]!;
    const jitter = (rng() - 0.5) * 3;
    targets.push(Math.max(56, Math.min(92, Math.round(leagueMean + offset + jitter))));
  }

  const clubs = targets.map((targetOvr, i) => {
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

  // Interleave the double round-robin: shuffle club order per half-season.
  const firstHalf = [...clubs].sort(() => rng() - 0.5);
  const secondHalf = [...clubs].sort(() => rng() - 0.5);
  return [...firstHalf, ...secondHalf].slice(0, count);
}

function buildHistoricalBestXi(
  entry: ClubSeasonKey,
  seasonLabel: string,
  ratePlayer: (id: string) => RatedPlayerCard | null,
): SimSquadInput | null {
  const rated = entry.playerIds
    .map((id) => ratePlayer(id))
    .filter((p): p is RatedPlayerCard => p != null);
  if (rated.length < 11) return null;

  const picked: RatedPlayerCard[] = [];
  const used = new Set<string>();

  for (const pos of FORMATION) {
    const candidates = rated
      .filter((p) => !used.has(p.playerId))
      .sort((a, b) => b.ovr - a.ovr);
    const match =
      candidates.find((p) => p.position === pos) ??
      candidates[0];
    if (!match) return null;
    picked.push(match);
    used.add(match.playerId);
  }

  if (picked.length < 11) return null;

  const squadOvr = Math.round(picked.reduce((s, p) => s + p.ovr, 0) / picked.length);
  return {
    name: `${clubDisplayName(entry.clubName)} ${seasonLabel}`,
    playerIds: picked.map((p) => p.playerId),
    squadOvr,
    players: picked,
  };
}

/**
 * Real archive squads for a league×season — replaces synthetic "Surname XI" rivals
 * when club-season data is available.
 */
export function generateHistoricalOpponents(opts: {
  leagueId: string;
  seasonLabel: string;
  matchCount: number;
  seed: string;
  userSquad?: SimSquadInput;
  ratePlayer: (id: string) => RatedPlayerCard | null;
}): SimSquadInput[] {
  const userIds = new Set(opts.userSquad?.playerIds ?? []);
  const clubs = listSimClubSeasons(opts.leagueId, opts.seasonLabel).filter(
    (entry) => !entry.playerIds.some((id) => userIds.has(id)),
  );
  if (!clubs.length) return [];

  const squads = clubs
    .map((entry) => buildHistoricalBestXi(entry, opts.seasonLabel, opts.ratePlayer))
    .filter((s): s is SimSquadInput => s != null);
  if (!squads.length) return [];

  const rng = createRng(`${opts.seed}:historical`);
  const firstHalf = [...squads].sort(() => rng() - 0.5);
  const secondHalf = [...squads].sort(() => rng() - 0.5);
  const cycle = [...firstHalf, ...secondHalf];
  const out: SimSquadInput[] = [];
  for (let i = 0; i < opts.matchCount; i++) {
    out.push(cycle[i % cycle.length]!);
  }
  return out;
}