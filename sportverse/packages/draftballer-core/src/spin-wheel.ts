import type {
  DraftDifficulty,
  DraftModeConfig,
  FormationSlot,
  Position,
  RatedPlayerCard,
  WheelBuildState,
  WheelSegment,
} from "@sportverse/draftballer-types";
import {
  clubDisplayName,
  fameTierFromScore,
  getDraftPlayers,
  getFameScore,
  listSpinnableClubSeasons,
  WHEEL_MIN_POOL_OVERLAP,
} from "@sportverse/sports-db";
import { squadRating } from "./draft-room.js";
import { draftPickAllowedForSlot } from "./squad-rules.js";
import { createRng, randomSessionSeed } from "./rng.js";

/** Position shapes mirrored from match-sim/formations.ts (dependency boundary — keep in sync). */
const FORMATION_SHAPES: Record<string, Position[]> = {
  "2-3-5": ["GK", "CB", "CB", "CM", "CM", "CM", "ST", "ST", "ST", "ST", "ST"],
  wm: ["GK", "CB", "CB", "CB", "CM", "CM", "AM", "AM", "ST", "ST", "ST"],
  "4-4-2": ["GK", "FB", "CB", "CB", "FB", "W", "CM", "CM", "W", "ST", "ST"],
  "4-4-2-diamond": ["GK", "FB", "CB", "CB", "FB", "DM", "CM", "CM", "AM", "ST", "ST"],
  "4-3-3": ["GK", "FB", "CB", "CB", "FB", "CM", "CM", "CM", "W", "ST", "W"],
  "4-2-3-1": ["GK", "FB", "CB", "CB", "FB", "DM", "DM", "AM", "W", "W", "ST"],
  "4-1-4-1": ["GK", "FB", "CB", "CB", "FB", "DM", "W", "CM", "CM", "W", "ST"],
  "4-5-1": ["GK", "FB", "CB", "CB", "FB", "W", "CM", "CM", "CM", "W", "ST"],
  "3-5-2": ["GK", "CB", "CB", "CB", "W", "CM", "CM", "CM", "W", "ST", "ST"],
  "3-4-3": ["GK", "CB", "CB", "CB", "W", "CM", "CM", "W", "ST", "ST", "ST"],
  "3-4-2-1": ["GK", "CB", "CB", "CB", "W", "CM", "CM", "W", "AM", "AM", "ST"],
  "5-3-2": ["GK", "FB", "CB", "CB", "CB", "FB", "CM", "CM", "CM", "ST", "ST"],
  "4-3-1-2": ["GK", "FB", "CB", "CB", "FB", "CM", "CM", "CM", "AM", "ST", "ST"],
};

const REROLLS: Record<DraftDifficulty, number> = { easy: 3, normal: 1, hard: 0 };

export function formationSlotsFromId(formationId = "4-3-3"): FormationSlot[] {
  const shape = FORMATION_SHAPES[formationId] ?? FORMATION_SHAPES["4-3-3"]!;
  return shape.map((position, i) => ({
    id: `slot_${i}`,
    position,
    playerId: undefined,
  }));
}

export function defaultFormation(): FormationSlot[] {
  return formationSlotsFromId("4-3-3");
}

export function listWheelFormationIds(): string[] {
  return Object.keys(FORMATION_SHAPES);
}

function difficultyRerolls(mode: DraftModeConfig): number {
  return REROLLS[mode.difficulty ?? "normal"];
}

function clubSeasonToSegment(entry: ReturnType<typeof listSpinnableClubSeasons>[0], idx: number): WheelSegment {
  const label = clubDisplayName(entry.clubName);
  return {
    id: `cs_${entry.clubId}_${entry.seasonLabel}_${idx}`,
    label,
    sublabel: entry.seasonLabel,
    club: label,
    clubId: entry.clubId,
    seasonLabel: entry.seasonLabel,
    fameSum: entry.fameSum,
    squadPlayerIds: entry.playerIds,
  };
}

/**
 * Sample wheel segments from curated club-seasons (recognizable leagues only).
 * Never falls back to raw career-club strings (ZB Home, youth aliases, …).
 */
export function buildWheelSegments(
  mode: DraftModeConfig,
  pool: RatedPlayerCard[],
  seed: string,
  count = 20,
): WheelSegment[] {
  const poolIds = new Set(pool.map((p) => p.playerId));
  const spinnable = listSpinnableClubSeasons(mode).filter((entry) => {
    let overlap = 0;
    for (const id of entry.playerIds) {
      if (poolIds.has(id)) {
        overlap++;
        if (overlap >= WHEEL_MIN_POOL_OVERLAP) return true;
      }
    }
    return false;
  });
  if (!spinnable.length) return [];

  const rng = createRng(`${seed}:segments`);
  const sampled = rng.weightedSample(
    spinnable,
    (s) => Math.sqrt(Math.max(1, s.fameSum)),
    Math.min(count, spinnable.length),
  );
  return sampled.map((entry, i) => clubSeasonToSegment(entry, i));
}

export function createWheelSession(
  mode: DraftModeConfig,
  pool: RatedPlayerCard[],
  seed = randomSessionSeed(),
): WheelBuildState {
  const formationId = mode.formationId ?? "4-3-3";
  const formation = formationSlotsFromId(formationId);
  return {
    mode: { ...mode, formationId },
    seed,
    segments: buildWheelSegments(mode, pool, seed),
    formation,
    roster: [],
    currentSlotIndex: 0,
    spunSegment: null,
    phase: "ready",
    spinsUsed: 0,
    squadSize: formation.length,
    rerollsLeft: difficultyRerolls(mode),
    seenPlayerIds: [],
    candidateIds: [],
    fallback: null,
  };
}

function targetPosition(state: WheelBuildState): Position | undefined {
  if (state.mode.draftOrder === "position_first" && state.selectedSlotIndex != null) {
    return state.formation[state.selectedSlotIndex]?.position;
  }
  return state.formation[state.currentSlotIndex]?.position;
}

function sampleCandidates(
  squadIds: string[],
  poolMap: Map<string, RatedPlayerCard>,
  picked: Set<string>,
  seen: Set<string>,
  position: Position | undefined,
  seed: string,
): RatedPlayerCard[] {
  let eligible = squadIds
    .map((id) => poolMap.get(id))
    .filter((c): c is RatedPlayerCard => !!c && !picked.has(c.playerId));

  // Never fall back to other positions — empty pool triggers respin UX.
  if (position) {
    eligible = eligible.filter((c) => draftPickAllowedForSlot(c, position, true));
  }
  if (!eligible.length) return [];

  const rng = createRng(`${seed}:candidates`);
  // Cache fame once per eligible row — avoid repeated index lookups in weight/sort.
  const fame = new Map(eligible.map((c) => [c.playerId, getFameScore(c.playerId)]));
  const weight = (c: RatedPlayerCard) =>
    Math.max(1, fame.get(c.playerId) ?? 0) * (seen.has(c.playerId) ? 0.3 : 1);

  const stars = eligible.filter((c) => (fame.get(c.playerId) ?? 0) >= 75);
  const sampled = rng.weightedSample(eligible, weight, Math.min(16, eligible.length));

  if (stars.length >= 2) {
    const guaranteed = rng.sample(stars, 2);
    const rest = sampled.filter((c) => !guaranteed.some((g) => g.playerId === c.playerId));
    return [...guaranteed, ...rest].slice(0, 16);
  }

  const obscureCount = sampled.filter(
    (c) => fameTierFromScore(fame.get(c.playerId) ?? 0) === "obscure",
  ).length;
  if (sampled.length && obscureCount / sampled.length > 0.3) {
    const known = eligible.filter((c) => (fame.get(c.playerId) ?? 0) >= 35);
    return rng.weightedSample(known.length ? known : eligible, weight, Math.min(16, eligible.length));
  }

  return sampled;
}

/**
 * Candidates for the current spin — always from the landed club-season squad.
 * Position soft-match may include teammates in other roles; never other clubs.
 */
export function getPickCandidates(
  state: WheelBuildState,
  pool: RatedPlayerCard[],
): RatedPlayerCard[] {
  if (!state.spunSegment) return [];
  const squadIds = state.spunSegment.squadPlayerIds;
  if (!squadIds?.length) return [];

  const picked = new Set(state.roster);
  const seen = new Set(state.seenPlayerIds);
  const position = targetPosition(state);
  const poolMap = new Map<string, RatedPlayerCard>();
  for (const p of pool) poolMap.set(p.playerId, p);

  return sampleCandidates(
    squadIds,
    poolMap,
    picked,
    seen,
    position,
    `${state.seed}:pick:${state.spinsUsed}`,
  );
}

export function getPickCandidatesStrict(
  state: WheelBuildState,
  pool: RatedPlayerCard[],
): RatedPlayerCard[] {
  return getPickCandidates(state, pool).filter((p) => {
    const pos = targetPosition(state);
    return !pos || draftPickAllowedForSlot(p, pos, true);
  });
}

/**
 * Filter pool to the spun club-season squad (or nationality slice).
 * Club wheels require squadPlayerIds — career `clubs[]` matching is not used.
 */
export function filterPlayersForSegment(
  segment: WheelSegment,
  pool: RatedPlayerCard[],
  pickedIds: Set<string>,
  requiredPosition?: Position,
): RatedPlayerCard[] {
  const poolMap = new Map(pool.map((p) => [p.playerId, p]));

  let bySegment: RatedPlayerCard[];
  if (segment.squadPlayerIds?.length) {
    bySegment = segment.squadPlayerIds
      .map((id) => poolMap.get(id))
      .filter((c): c is RatedPlayerCard => !!c && !pickedIds.has(c.playerId));
  } else if (segment.nationality) {
    const rawById = new Map(getDraftPlayers().map((p) => [p.id, p]));
    bySegment = pool.filter((card) => {
      if (pickedIds.has(card.playerId)) return false;
      return rawById.get(card.playerId)?.nationality === segment.nationality;
    });
  } else {
    bySegment = [];
  }

  if (!requiredPosition) return bySegment;
  const byPos = bySegment.filter((c) => draftPickAllowedForSlot(c, requiredPosition, true));
  return byPos;
}

export function spinToSegment(
  state: WheelBuildState,
  segmentIndex: number,
  pool: RatedPlayerCard[],
): WheelBuildState {
  const segments =
    state.segments.length > 0
      ? state.segments
      : buildWheelSegments(state.mode, pool, state.seed, 20);
  if (!segments.length) {
    return {
      ...state,
      segments,
      spunSegment: null,
      phase: "ready",
      candidateIds: [],
      fallback: null,
    };
  }
  const segment = segments[segmentIndex % segments.length]!;
  const position = targetPosition(state);
  const picked = new Set(state.roster);
  const poolMap = new Map<string, RatedPlayerCard>();
  for (const p of pool) poolMap.set(p.playerId, p);
  const squadIds = segment.squadPlayerIds ?? [];
  const candidates = sampleCandidates(
    squadIds,
    poolMap,
    picked,
    new Set(state.seenPlayerIds),
    position,
    `${state.seed}:spin:${state.spinsUsed + 1}`,
  );

  let fallback: WheelBuildState["fallback"] = null;
  if (squadIds.length && position && candidates.length === 0) {
    fallback = state.rerollsLeft > 0 ? "respin_free" : "out_of_position";
  }

  return {
    ...state,
    segments,
    spunSegment: segment,
    phase: "picking",
    spinsUsed: state.spinsUsed + 1,
    candidateIds: candidates.map((c) => c.playerId),
    fallback,
  };
}

export function useReroll(state: WheelBuildState, pool: RatedPlayerCard[]): WheelBuildState {
  if (state.rerollsLeft <= 0) throw new Error("No rerolls left");
  const currentIdx = state.spunSegment
    ? state.segments.findIndex((s) => s.id === state.spunSegment!.id)
    : -1;
  const idx = randomSegmentIndex(
    state.segments,
    state.seed,
    state.spinsUsed + 7919,
    currentIdx >= 0 ? currentIdx : undefined,
  );
  return {
    ...spinToSegment({ ...state, rerollsLeft: state.rerollsLeft - 1 }, idx, pool),
    rerollsLeft: state.rerollsLeft - 1,
  };
}

export function pickPlayerForSlot(
  state: WheelBuildState,
  playerId: string,
  pool: RatedPlayerCard[],
): WheelBuildState {
  if (state.phase !== "picking" || !state.spunSegment) throw new Error("Not in picking phase");
  const poolMap = new Map(pool.map((p) => [p.playerId, p]));
  const card = poolMap.get(playerId);
  if (!card) throw new Error("Unknown player");

  const candidates = getPickCandidates(state, pool);
  if (!candidates.some((p) => p.playerId === playerId)) throw new Error("Player not eligible for this spin");

  let slotIndex = state.currentSlotIndex;
  if (state.mode.draftOrder === "squad_first") {
    const open = state.formation.findIndex((s) => !s.playerId && draftPickAllowedForSlot(card, s.position, true));
    if (open >= 0) slotIndex = open;
  } else if (state.selectedSlotIndex != null) {
    slotIndex = state.selectedSlotIndex;
  }

  const targetSlot = state.formation[slotIndex];
  if (!targetSlot) throw new Error("No formation slot");
  if (!draftPickAllowedForSlot(card, targetSlot.position, true)) {
    throw new Error(`${card.name} cannot play ${targetSlot.position}`);
  }

  const formation = state.formation.map((slot, i) =>
    i === slotIndex ? { ...slot, playerId } : slot,
  );
  const roster = [...state.roster, playerId];
  const nextSlot = state.formation.findIndex((s) => !s.playerId && s.id !== formation[slotIndex]?.id);
  const filled = formation.every((s) => s.playerId);
  const complete = filled || roster.length >= state.squadSize;

  const seenTwice = state.seenPlayerIds.filter((id) => id === playerId).length >= 1;
  const seenPlayerIds = seenTwice
    ? state.seenPlayerIds
    : [...state.seenPlayerIds, playerId];

  return {
    ...state,
    formation,
    roster,
    currentSlotIndex: complete ? state.squadSize : Math.max(0, nextSlot),
    spunSegment: null,
    phase: complete ? "complete" : "ready",
    candidateIds: [],
    fallback: null,
    selectedSlotIndex: undefined,
  };
}

export function wheelSquadRating(state: WheelBuildState, pool: RatedPlayerCard[]): number {
  const poolMap = new Map(pool.map((p) => [p.playerId, p]));
  return squadRating(state.roster, poolMap);
}

export function currentFormationSlot(state: WheelBuildState): FormationSlot | undefined {
  if (state.mode.draftOrder === "position_first" && state.selectedSlotIndex != null) {
    return state.formation[state.selectedSlotIndex];
  }
  return state.formation[state.currentSlotIndex];
}

/** Salt must change each spin (e.g. spinsUsed) so consecutive spins differ. */
export function randomSegmentIndex(
  segments: WheelSegment[],
  seed: string,
  spinSalt = 0,
  excludeIndex?: number,
): number {
  if (!segments.length) return 0;
  if (segments.length === 1) return 0;
  const rng = createRng(`${seed}:spin-index:${spinSalt}`);
  let idx = Math.floor(rng.next() * segments.length);
  if (excludeIndex != null && excludeIndex >= 0 && idx === excludeIndex) {
    idx = (idx + 1 + Math.floor(rng.next() * (segments.length - 1))) % segments.length;
  }
  return idx;
}

/**
 * Swap two filled slots when each player can legally play the other's position.
 */
export function swapFormationSlots(
  state: WheelBuildState,
  slotIndexA: number,
  slotIndexB: number,
  pool: RatedPlayerCard[],
): WheelBuildState {
  if (slotIndexA === slotIndexB) return state;
  const a = state.formation[slotIndexA];
  const b = state.formation[slotIndexB];
  if (!a?.playerId || !b?.playerId) throw new Error("Both slots must be filled to swap");
  const poolMap = new Map(pool.map((p) => [p.playerId, p]));
  const playerA = poolMap.get(a.playerId);
  const playerB = poolMap.get(b.playerId);
  if (!playerA || !playerB) throw new Error("Unknown player in formation");
  if (!draftPickAllowedForSlot(playerA, b.position, true)) {
    throw new Error(`${playerA.name} cannot play ${b.position}`);
  }
  if (!draftPickAllowedForSlot(playerB, a.position, true)) {
    throw new Error(`${playerB.name} cannot play ${a.position}`);
  }
  const formation = state.formation.map((slot, i) => {
    if (i === slotIndexA) return { ...slot, playerId: b.playerId };
    if (i === slotIndexB) return { ...slot, playerId: a.playerId };
    return slot;
  });
  return { ...state, formation };
}

export function selectFormationSlot(state: WheelBuildState, slotIndex: number): WheelBuildState {
  if (slotIndex < 0 || slotIndex >= state.formation.length) return state;
  const slot = state.formation[slotIndex]!;
  if (slot.playerId) {
    return { ...state, selectedSlotIndex: slotIndex };
  }
  return {
    ...state,
    selectedSlotIndex: slotIndex,
    currentSlotIndex: slotIndex,
    mode: { ...state.mode, draftOrder: "position_first" },
  };
}

export function normalizeSegmentsForWheel(segments: WheelSegment[], max = 24): WheelSegment[] {
  return segments.slice(0, max);
}
