import type {
  ExtendedMatchEventType,
  PitchZone,
  TacticalIdentity,
} from "@sportverse/draftballer-types";

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

/** Templated overload line when zone overload is decisive (|Δ| ≥ 0.08). */
export function overloadCommentary(
  teamName: string,
  zone: PitchZone,
  delta: number,
  atkFormationId: string,
  defFormationId: string,
): string {
  const zoneLabel = zone.replace(/_/g, " ");
  if (delta >= 0.08) {
    return `Tactical matchup: ${teamName} overload the ${zoneLabel} — ${atkFormationId} stretching ${defFormationId}.`;
  }
  return `Tactical matchup: ${teamName} are crowded out in the ${zoneLabel} — ${defFormationId} holding firm.`;
}

const IDENTITY_HINTS: Record<TacticalIdentity, string> = {
  possession: "Possession thrives when pitch quality is high",
  high_press: "High-Press rewards tempo and stamina",
  counter: "Counter punches suit transitional chaos",
  route_one: "Route-One thrives in physical eras",
  balanced: "Balanced adapts to most conditions",
};

export function tacticalIdentityHint(identity: TacticalIdentity): string {
  return IDENTITY_HINTS[identity];
}
