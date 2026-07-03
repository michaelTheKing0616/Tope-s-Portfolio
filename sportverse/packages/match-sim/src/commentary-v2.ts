import type { ExtendedMatchEventType } from "@sportverse/draftballer-types";

export function commentaryForV2(
  type: ExtendedMatchEventType | "kickoff" | "fulltime" | "goal" | "chance_missed" | "shot_saved",
  scorer?: string,
  minute?: number,
  eraLabel?: string,
): string {
  const min = minute != null ? `${minute}'` : "";
  const name = scorer ?? "The attacker";
  const era = eraLabel ? ` (${eraLabel} conditions)` : "";

  if (type === "kickoff") return `Kick-off — floodlights on${era}.`;
  if (type === "fulltime") return "Full time.";
  if (type === "goal") return min ? `${min} GOAL! ${name} finds the net!` : `GOAL! ${name}!`;
  if (type === "chance_missed") return min ? `${min} ${name} fires wide.` : `${name} misses.`;
  if (type === "shot_saved") return min ? `${min} Saved! ${name} denied.` : `Save vs ${name}.`;
  return "";
}

export function fitCommentary(playerName: string, delta: number): string {
  if (delta >= 5) return `${playerName}'s silky touch is cutting through these conditions.`;
  if (delta <= -5) return `${playerName} is finding it hard to get a foothold in this physical battle.`;
  return `${playerName} adapting to the match conditions.`;
}

export function momentumCommentary(teamName: string, momentum: number): string {
  return `${teamName} have completely seized control${momentum > 0 ? " of this half" : ""}.`;
}

export function tacticalPreviewHeadline(
  homeName: string,
  awayName: string,
  homeTri: number,
  awayTri: number,
): string {
  const label = (tri: number, fallback: string) =>
    tri >= 0.55 ? "The Technicians" : tri <= 0.35 ? "The Iron Wall" : fallback;
  return `${label(homeTri, homeName)} vs ${label(awayTri, awayName)}`;
}
