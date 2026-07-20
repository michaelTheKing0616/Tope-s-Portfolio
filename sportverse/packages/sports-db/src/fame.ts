export interface FameEntry {
  playerId: string;
  fameScore: number;
  peakMv?: number;
  peakMvYear?: number;
  durability?: number;
}

export type FameTier = "icon" | "star" | "known" | "cult" | "obscure";

let fameByPlayer = new Map<string, FameEntry>();

export function setFameIndex(entries: FameEntry[]): void {
  fameByPlayer = new Map(entries.map((e) => [e.playerId, e]));
}

export function getFameEntry(playerId: string): FameEntry | undefined {
  return fameByPlayer.get(playerId);
}

export function getFameScore(playerId: string): number {
  return fameByPlayer.get(playerId)?.fameScore ?? 0;
}

export function getDurability(playerId: string): number {
  return fameByPlayer.get(playerId)?.durability ?? 1;
}

export function fameTierFromScore(score: number): FameTier {
  if (score >= 92) return "icon";
  if (score >= 75) return "star";
  if (score >= 55) return "known";
  if (score >= 35) return "cult";
  return "obscure";
}

export function getFameIndex(): FameEntry[] {
  return [...fameByPlayer.values()];
}
