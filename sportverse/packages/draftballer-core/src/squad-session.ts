import type { DraftModeConfig, RatedPlayerCard, SavedSquadPayload, SimSquadInput } from "@sportverse/draftballer-types";

const STORAGE_KEY = "db_squad";

export function saveSquadForSeason(
  mode: DraftModeConfig,
  playerIds: string[],
  pool: RatedPlayerCard[],
  squadOvr: number,
  source: SavedSquadPayload["source"],
): void {
  const players = playerIds.map((id) => pool.find((p) => p.playerId === id)).filter(Boolean) as RatedPlayerCard[];
  const payload = {
    mode,
    playerIds,
    squadOvr,
    source,
    players,
  };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function loadSquadForSeason(): (SavedSquadPayload & { players: RatedPlayerCard[] }) | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function toSimSquadInput(
  name: string,
  players: RatedPlayerCard[],
  squadOvr: number,
): SimSquadInput {
  return {
    name,
    playerIds: players.map((p) => p.playerId),
    players,
    squadOvr,
  };
}
