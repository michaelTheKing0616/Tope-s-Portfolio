import type { MatchEventType } from "@sportverse/draftballer-types";

const GOAL_LINES = [
  "{scorer} finds the net!",
  "What a finish from {scorer}!",
  "{scorer} buries it — the crowd erupts!",
  "Clinical from {scorer}.",
];

const CHANCE_LINES = [
  "{scorer} sees space but fires wide.",
  "Close for {scorer} — just missing the target.",
  "{scorer} denied by the woodwork!",
];

const SAVE_LINES = [
  "Outstanding save to deny {scorer}.",
  "The keeper stands tall against {scorer}.",
];

export function commentaryFor(
  type: MatchEventType,
  scorer?: string,
  minute?: number,
): string {
  const min = minute != null ? `${minute}'` : "";
  const name = scorer ?? "The attacker";

  if (type === "goal") {
    const line = GOAL_LINES[Math.floor(Math.random() * GOAL_LINES.length)]!;
    return min ? `${min} ${line.replace("{scorer}", name)}` : line.replace("{scorer}", name);
  }
  if (type === "chance_missed") {
    const line = CHANCE_LINES[Math.floor(Math.random() * CHANCE_LINES.length)]!;
    return min ? `${min} ${line.replace("{scorer}", name)}` : line.replace("{scorer}", name);
  }
  if (type === "shot_saved") {
    const line = SAVE_LINES[Math.floor(Math.random() * SAVE_LINES.length)]!;
    return min ? `${min} ${line.replace("{scorer}", name)}` : line.replace("{scorer}", name);
  }
  if (type === "kickoff") return "Kick-off — the floodlights are on.";
  return "Full time.";
}
