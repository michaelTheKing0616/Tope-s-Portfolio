import type {
  DraftModeConfig,
  FormationSlot,
  Position,
  RatedPlayerCard,
  WheelBuildState,
  WheelSegment,
} from "@sportverse/draftballer-types";
import { getDraftPlayers, getSeasonStats, shuffle } from "@sportverse/sports-db";
import { squadRating } from "./draft-room.js";
import { draftPickAllowedForSlot } from "./squad-rules.js";

const ERA_LABELS = ["1990s", "2000s", "2010s", "2020s", "All-Time"];

const FORMATION_433: Position[] = ["GK", "CB", "CB", "FB", "FB", "CM", "CM", "AM", "W", "W", "ST"];

export function defaultFormation(): FormationSlot[] {
  return FORMATION_433.map((position, i) => ({
    id: `slot_${i}`,
    position,
    playerId: undefined,
  }));
}

function erasForMode(mode: DraftModeConfig): string[] {
  if (mode.era === "decade" && mode.decade) return [mode.decade];
  if (mode.era === "single_year" && mode.year) return [String(mode.year)];
  if (mode.era === "all_time") return ["All-Time", "2000s", "2010s", "2020s"];
  return ERA_LABELS.slice(0, 4);
}

/** Build wheel segments from the active draft pool and mode filters. */
export function buildWheelSegments(mode: DraftModeConfig, pool: RatedPlayerCard[]): WheelSegment[] {
  const poolIds = new Set(pool.map((p) => p.playerId));
  const players = getDraftPlayers().filter((p) => poolIds.has(p.id));
  const eras = erasForMode(mode);

  const intlMode =
    mode.competitionScope === "international" || mode.ratingLens === "international_only";

  if (intlMode) {
    const nationalities = [...new Set(players.map((p) => p.nationality).filter(Boolean))] as string[];
    const segments: WheelSegment[] = [];
    let idx = 0;
    for (const nationality of nationalities.sort()) {
      for (const era of eras) {
        segments.push({
          id: `nat_${idx++}`,
          label: nationality,
          sublabel: era,
          nationality,
          eraLabel: era,
        });
      }
    }
    return normalizeSegmentsForWheel(segments);
  }

  const clubs = [...new Set(players.flatMap((p) => p.clubs ?? []))].sort();
  const segments: WheelSegment[] = [];
  let idx = 0;
  for (const club of clubs) {
    for (const era of eras) {
      segments.push({
        id: `club_${idx++}`,
        label: club,
        sublabel: era,
        club,
        eraLabel: era,
      });
    }
  }
  return normalizeSegmentsForWheel(segments);
}

/** Keep the wheel readable — one primary segment per club/nation when the pool is huge. */
export function normalizeSegmentsForWheel(segments: WheelSegment[], max = 24): WheelSegment[] {
  if (segments.length <= max) return segments.length >= 6 ? segments : duplicateToMin(segments, 6);

  const byLabel = new Map<string, WheelSegment>();
  for (const segment of shuffle(segments)) {
    if (!byLabel.has(segment.label)) byLabel.set(segment.label, segment);
  }
  const trimmed = shuffle([...byLabel.values()]).slice(0, max);
  return trimmed.length >= 6 ? trimmed : duplicateToMin(trimmed, 6);
}

function duplicateToMin(segments: WheelSegment[], min: number): WheelSegment[] {
  if (segments.length === 0) return segments;
  const out = [...segments];
  while (out.length < min) {
    out.push({ ...segments[out.length % segments.length]!, id: `${segments[out.length % segments.length]!.id}_dup_${out.length}` });
  }
  return out;
}

export function createWheelSession(mode: DraftModeConfig, pool: RatedPlayerCard[]): WheelBuildState {
  return {
    mode,
    segments: buildWheelSegments(mode, pool),
    formation: defaultFormation(),
    roster: [],
    currentSlotIndex: 0,
    spunSegment: null,
    phase: "ready",
    spinsUsed: 0,
    squadSize: FORMATION_433.length,
  };
}

export function filterPlayersForSegment(
  segment: WheelSegment,
  pool: RatedPlayerCard[],
  pickedIds: Set<string>,
  requiredPosition?: Position,
): RatedPlayerCard[] {
  const rawById = new Map(getDraftPlayers().map((p) => [p.id, p]));

  const bySegment = pool.filter((card) => {
    if (pickedIds.has(card.playerId)) return false;
    const raw = rawById.get(card.playerId);
    if (!raw) return false;
    if (segment.eraLabel && segment.eraLabel !== "All-Time") {
      const decades = raw.decades ?? [];
      const fromStats = getSeasonStats(card.playerId).some(
        (s) => seasonToDecade(s.seasonLabel) === segment.eraLabel,
      );
      if (!decades.length && !fromStats) return false;
      if (decades.length && !decades.includes(segment.eraLabel) && !fromStats) return false;
    }
    if (segment.nationality) return raw.nationality === segment.nationality;
    if (segment.club) return raw.clubs?.includes(segment.club) ?? false;
    return true;
  });

  if (!requiredPosition) return bySegment;
  const byPos = bySegment.filter((c) => c.position === requiredPosition);
  return byPos.length ? byPos : bySegment;
}

/** Candidates for the current pick — segment + position first, then sensible fallbacks. */
export function getPickCandidates(
  state: WheelBuildState,
  pool: RatedPlayerCard[],
): RatedPlayerCard[] {
  if (!state.spunSegment) return [];
  const picked = new Set(state.roster);
  const slot = state.formation[state.currentSlotIndex];
  const position = slot?.position;

  const segmentMatch = filterPlayersForSegment(state.spunSegment, pool, picked, position);
  if (segmentMatch.length) return segmentMatch;

  const segmentAnyPos = filterPlayersForSegment(state.spunSegment, pool, picked);
  if (segmentAnyPos.length) return segmentAnyPos;

  const anyPos = pool.filter(
    (p) => !picked.has(p.playerId) && draftPickAllowedForSlot(p, position!, false),
  );
  if (anyPos.length) return anyPos;

  return pool.filter((p) => !picked.has(p.playerId));
}

/** Strict position lock — no fallback to wrong positions when enabled. */
export function getPickCandidatesStrict(
  state: WheelBuildState,
  pool: RatedPlayerCard[],
): RatedPlayerCard[] {
  if (!state.spunSegment) return [];
  const picked = new Set(state.roster);
  const slot = state.formation[state.currentSlotIndex];
  const position = slot?.position;
  if (!position) return [];

  const segmentMatch = filterPlayersForSegment(state.spunSegment, pool, picked, position);
  const locked = segmentMatch.filter((p) => draftPickAllowedForSlot(p, position, true));
  if (locked.length) return locked;

  return filterPlayersForSegment(state.spunSegment, pool, picked, position).filter((p) =>
    draftPickAllowedForSlot(p, position, true),
  );
}

export function randomSegmentIndex(segments: WheelSegment[]): number {
  return Math.floor(Math.random() * segments.length);
}

export function spinToSegment(state: WheelBuildState, segmentIndex: number): WheelBuildState {
  const segment = state.segments[segmentIndex % state.segments.length]!;
  return {
    ...state,
    spunSegment: segment,
    phase: "picking",
    spinsUsed: state.spinsUsed + 1,
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

  const formation = state.formation.map((slot, i) =>
    i === state.currentSlotIndex ? { ...slot, playerId } : slot,
  );
  const roster = [...state.roster, playerId];
  const nextSlot = state.currentSlotIndex + 1;
  const complete = nextSlot >= state.squadSize;

  return {
    ...state,
    formation,
    roster,
    currentSlotIndex: nextSlot,
    spunSegment: null,
    phase: complete ? "complete" : "ready",
  };
}

export function wheelSquadRating(state: WheelBuildState, pool: RatedPlayerCard[]): number {
  const poolMap = new Map(pool.map((p) => [p.playerId, p]));
  return squadRating(state.roster, poolMap);
}

export function currentFormationSlot(state: WheelBuildState): FormationSlot | undefined {
  return state.formation[state.currentSlotIndex];
}

function seasonToDecade(seasonLabel: string): string {
  const y = Number(seasonLabel);
  if (!y || y < 2000) return "1990s";
  if (y < 2010) return "2000s";
  if (y < 2020) return "2010s";
  return "2020s";
}
