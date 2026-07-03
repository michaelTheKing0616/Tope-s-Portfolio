import type { BlindRoundState, DraftPick, DraftRoomState, RatedPlayerCard } from "@sportverse/draftballer-types";

export function currentBlindRound(room: DraftRoomState): number {
  return Math.floor(room.currentPickIndex / room.drafterCount) + 1;
}

export function initBlindRound(room: DraftRoomState): DraftRoomState {
  if (room.format !== "blind") throw new Error("Not a blind room");
  return {
    ...room,
    blindRound: {
      round: currentBlindRound(room),
      submissions: [],
      complete: false,
    },
  };
}

export function validateBlindPick(
  room: DraftRoomState,
  drafterIndex: number,
  playerId: string,
): string | null {
  if (room.format !== "blind") return "Not a blind room";
  if (room.status !== "picking") return "Draft complete";

  const round = room.blindRound ?? initBlindRound(room).blindRound!;
  if (round.complete) return "Round already resolved";
  if (round.submissions.some((s) => s.drafterIndex === drafterIndex)) return "Already submitted";
  if (!room.poolIds.includes(playerId)) return "Player not in pool";
  if (room.rosters[drafterIndex]!.length >= room.squadSize) return "Squad full";

  const taken = round.submissions.some((s) => s.playerId === playerId);
  if (taken) return "Player already selected this round";

  return null;
}

export function submitBlindPick(
  room: DraftRoomState,
  drafterIndex: number,
  player: RatedPlayerCard,
): { room: DraftRoomState; error?: string } {
  const err = validateBlindPick(room, drafterIndex, player.playerId);
  if (err) return { room, error: err };

  const round: BlindRoundState = room.blindRound ?? {
    round: currentBlindRound(room),
    submissions: [],
    complete: false,
  };

  return {
    room: {
      ...room,
      blindRound: {
        ...round,
        submissions: [
          ...round.submissions,
          {
            drafterIndex,
            playerId: player.playerId,
            playerName: player.name,
            ovr: player.ovr,
          },
        ],
      },
    },
  };
}

export function blindRoundReady(room: DraftRoomState): boolean {
  const round = room.blindRound;
  if (!round || round.complete) return false;
  const activeDrafters = room.rosters.filter((r) => r.length < room.squadSize).length;
  return round.submissions.length >= activeDrafters;
}

/** Resolve conflicts — lower drafter index wins ties. */
export function resolveBlindRound(room: DraftRoomState): { room: DraftRoomState; error?: string } {
  if (room.format !== "blind") return { room, error: "Not a blind room" };
  const round = room.blindRound;
  if (!round || round.complete) return { room, error: "No active blind round" };
  if (!blindRoundReady(room)) return { room, error: "Not all picks submitted" };

  const claimed = new Set<string>();
  const winners: typeof round.submissions = [];

  const ordered = [...round.submissions].sort((a, b) => a.drafterIndex - b.drafterIndex);
  for (const sub of ordered) {
    if (claimed.has(sub.playerId)) continue;
    if (room.rosters[sub.drafterIndex]!.length >= room.squadSize) continue;
    claimed.add(sub.playerId);
    winners.push(sub);
  }

  let next = { ...room };
  const newPicks: DraftPick[] = [];

  for (const win of winners) {
    const pick: DraftPick = {
      round: round.round,
      pickInRound: win.drafterIndex + 1,
      drafterIndex: win.drafterIndex,
      playerId: win.playerId,
      playerName: win.playerName,
      ovr: win.ovr,
    };
    newPicks.push(pick);
    next = {
      ...next,
      picks: [...next.picks, pick],
      rosters: next.rosters.map((r, i) => (i === win.drafterIndex ? [...r, win.playerId] : r)),
      poolIds: next.poolIds.filter((id) => id !== win.playerId),
      currentPickIndex: next.currentPickIndex + 1,
    };
  }

  const totalPicks = next.drafterCount * next.squadSize;
  const complete = next.currentPickIndex >= totalPicks || next.poolIds.length === 0;

  return {
    room: {
      ...next,
      status: complete ? "complete" : "picking",
      blindRound: { ...round, complete: true },
    },
  };
}

export function startNextBlindRound(room: DraftRoomState): DraftRoomState {
  if (room.status === "complete") return room;
  return initBlindRound({ ...room, blindRound: null });
}

/** Bot picks best available OVR not yet taken this round. */
export function botBlindPick(
  room: DraftRoomState,
  drafterIndex: number,
  pool: Map<string, RatedPlayerCard>,
): RatedPlayerCard | null {
  const round = room.blindRound;
  const takenThisRound = new Set(round?.submissions.map((s) => s.playerId) ?? []);
  const candidates = room.poolIds
    .filter((id) => !takenThisRound.has(id))
    .map((id) => pool.get(id))
    .filter(Boolean)
    .sort((a, b) => b!.ovr - a!.ovr) as RatedPlayerCard[];
  return candidates[0] ?? null;
}
