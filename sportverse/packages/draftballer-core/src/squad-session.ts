import type { DraftModeConfig, RatedPlayerCard, SavedSquadPayload, SimSquadInput } from "@sportverse/draftballer-types";

const STORAGE_KEY = "db_squad";

export function saveSquadForSeason(
  mode: DraftModeConfig,
  playerIds: string[],
  pool: RatedPlayerCard[],
  squadOvr: number,
  source: SavedSquadPayload["source"],
  extras: {
    seed?: string;
    formationId?: string;
    tacticalIdentity?: SavedSquadPayload["tacticalIdentity"];
    eraContext?: SavedSquadPayload["eraContext"];
    simulationMode?: SavedSquadPayload["simulationMode"];
  } = {},
): void {
  const players = playerIds.map((id) => pool.find((p) => p.playerId === id)).filter(Boolean) as RatedPlayerCard[];
  const payload: SavedSquadPayload & { players: RatedPlayerCard[] } = {
    mode,
    playerIds,
    squadOvr,
    source,
    seed: extras.seed,
    formationId: extras.formationId ?? mode.formationId ?? "4-3-3",
    tacticalIdentity: extras.tacticalIdentity,
    eraContext: extras.eraContext,
    simulationMode: extras.simulationMode,
    players,
  };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

/** Merge Match Conditions into the persisted squad without rewriting the XI. */
export function patchSquadSimConditions(
  patch: Pick<SavedSquadPayload, "eraContext" | "simulationMode" | "tacticalIdentity" | "formationId">,
): void {
  const current = loadSquadForSeason();
  if (!current) return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...patch }));
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
