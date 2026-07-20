import type { PlayerAttributes, Position, RatedPlayerCard } from "@sportverse/draftballer-types";
import { hashSeed } from "./rng.js";

export type PlayerArchetype =
  | "Clinical Finisher"
  | "Complete Forward"
  | "Target Man"
  | "Pressing Machine"
  | "Wing Wizard"
  | "Playmaker"
  | "Box-to-Box Engine"
  | "Deep-Lying Orchestrator"
  | "Ball Winner"
  | "Defensive Wall"
  | "Overlapping Full-Back"
  | "Sweeper Keeper"
  | "Shot-Stopper"
  | "Balanced Operator";

export type SignatureMove =
  | "Curved Runs"
  | "Long Shot"
  | "Through Ball"
  | "Aggressive Tackle"
  | "Aerial Threat"
  | "Explosive Pace"
  | "Close Control"
  | "Set-Piece Threat"
  | "Box Presence"
  | "Distribution"
  | "Sweeping"
  | "Press Trigger";

export interface FormationFitRow {
  formationId: string;
  stars: number; // 1–5
}

export interface PlayerCardProfile {
  archetype: PlayerArchetype;
  signature: SignatureMove;
  /** Estimated weak-foot stars 1–5 — derived, not licensed data. */
  weakFoot: number;
  /** Estimated skill moves 1–5 — derived, not licensed data. */
  skillMoves: number;
  workRate: { attack: "High" | "Med" | "Low"; defense: "High" | "Med" | "Low" };
  formationFits: FormationFitRow[];
  influence: {
    attack: number;
    press: number;
    passing: number;
    defense: number;
    aerial: number;
  };
}

function clampStar(n: number): number {
  return Math.max(1, Math.min(5, Math.round(n)));
}

function workBand(v: number): "High" | "Med" | "Low" {
  if (v >= 78) return "High";
  if (v >= 62) return "Med";
  return "Low";
}

function scoreArchetypes(pos: Position, a: PlayerAttributes): { id: PlayerArchetype; score: number }[] {
  if (pos === "GK") {
    return [
      { id: "Sweeper Keeper", score: a.pas * 0.45 + a.pac * 0.35 + a.dri * 0.2 },
      { id: "Shot-Stopper", score: a.def * 0.5 + a.phy * 0.3 + a.sho * 0.2 },
    ];
  }
  return [
    { id: "Clinical Finisher", score: a.sho * 0.55 + a.pac * 0.25 + a.dri * 0.2 },
    { id: "Complete Forward", score: (a.sho + a.pas + a.phy + a.dri) / 4 },
    { id: "Target Man", score: a.phy * 0.5 + a.sho * 0.35 + a.pas * 0.15 },
    { id: "Pressing Machine", score: a.pac * 0.4 + a.phy * 0.35 + a.def * 0.25 },
    { id: "Wing Wizard", score: a.pac * 0.4 + a.dri * 0.4 + a.pas * 0.2 },
    { id: "Playmaker", score: a.pas * 0.5 + a.dri * 0.3 + a.sho * 0.2 },
    { id: "Box-to-Box Engine", score: a.phy * 0.35 + a.pas * 0.3 + a.def * 0.2 + a.pac * 0.15 },
    { id: "Deep-Lying Orchestrator", score: a.pas * 0.55 + a.def * 0.25 + a.dri * 0.2 },
    { id: "Ball Winner", score: a.def * 0.5 + a.phy * 0.35 + a.pac * 0.15 },
    { id: "Defensive Wall", score: a.def * 0.55 + a.phy * 0.35 + a.pas * 0.1 },
    { id: "Overlapping Full-Back", score: a.pac * 0.4 + a.pas * 0.3 + a.def * 0.3 },
    { id: "Balanced Operator", score: (a.pac + a.sho + a.pas + a.dri + a.def + a.phy) / 6 },
  ];
}

function positionBias(pos: Position, id: PlayerArchetype): number {
  const map: Partial<Record<Position, PlayerArchetype[]>> = {
    ST: ["Clinical Finisher", "Complete Forward", "Target Man", "Pressing Machine"],
    W: ["Wing Wizard", "Clinical Finisher", "Pressing Machine"],
    AM: ["Playmaker", "Wing Wizard", "Box-to-Box Engine"],
    CM: ["Box-to-Box Engine", "Playmaker", "Deep-Lying Orchestrator", "Ball Winner"],
    DM: ["Ball Winner", "Deep-Lying Orchestrator", "Defensive Wall"],
    CB: ["Defensive Wall", "Ball Winner"],
    FB: ["Overlapping Full-Back", "Defensive Wall", "Wing Wizard"],
    GK: ["Sweeper Keeper", "Shot-Stopper"],
  };
  const preferred = map[pos] ?? [];
  const idx = preferred.indexOf(id);
  if (idx < 0) return 0;
  return (preferred.length - idx) * 4;
}

function deriveSignature(pos: Position, a: PlayerAttributes, archetype: PlayerArchetype): SignatureMove {
  if (pos === "GK") return a.pas >= a.def ? "Distribution" : "Sweeping";
  if (archetype === "Clinical Finisher" || archetype === "Complete Forward") {
    return a.pac >= a.phy ? "Curved Runs" : "Box Presence";
  }
  if (archetype === "Target Man") return "Aerial Threat";
  if (archetype === "Wing Wizard") return a.dri >= a.pac ? "Close Control" : "Explosive Pace";
  if (archetype === "Playmaker" || archetype === "Deep-Lying Orchestrator") return "Through Ball";
  if (archetype === "Ball Winner" || archetype === "Defensive Wall") return "Aggressive Tackle";
  if (archetype === "Pressing Machine") return "Press Trigger";
  if (a.sho >= 85 && a.pas < 80) return "Long Shot";
  if (a.pas >= 86) return "Set-Piece Threat";
  if (a.phy >= 86 && a.sho >= 78) return "Aerial Threat";
  if (a.pac >= 88) return "Explosive Pace";
  return "Close Control";
}

function formationFits(pos: Position, a: PlayerAttributes): FormationFitRow[] {
  const attack = (a.sho + a.pac + a.dri) / 3;
  const mid = (a.pas + a.dri + a.phy) / 3;
  const defend = (a.def + a.phy + a.pas) / 3;
  const rows: { formationId: string; base: number }[] = [
    { formationId: "4-3-3", base: pos === "W" || pos === "ST" || pos === "CM" ? attack : mid * 0.85 },
    { formationId: "4-2-3-1", base: pos === "AM" || pos === "DM" || pos === "ST" ? (attack + mid) / 2 : mid },
    { formationId: "3-5-2", base: pos === "FB" || pos === "CM" || pos === "ST" ? mid : defend * 0.9 },
    { formationId: "4-4-2", base: pos === "ST" || pos === "CM" || pos === "FB" ? (attack + mid) / 2 : mid * 0.9 },
    { formationId: "5-3-2", base: pos === "CB" || pos === "DM" || pos === "FB" ? defend : mid * 0.8 },
  ];
  return rows
    .map((r) => ({
      formationId: r.formationId,
      stars: clampStar(r.base / 18),
    }))
    .sort((x, y) => y.stars - x.stars)
    .slice(0, 4);
}

/**
 * Derive draft-facing profile from rating attributes.
 * Weak foot / skill moves are seeded estimates (not Transfermarkt licensed fields).
 */
export function derivePlayerCardProfile(card: RatedPlayerCard): PlayerCardProfile {
  const a = card.attributes;
  const scored = scoreArchetypes(card.position, a)
    .map((s) => ({ ...s, score: s.score + positionBias(card.position, s.id) }))
    .sort((x, y) => y.score - x.score);
  const archetype = scored[0]?.id ?? "Balanced Operator";
  const signature = deriveSignature(card.position, a, archetype);

  const seed = hashSeed(`${card.playerId}:card-meta`);
  const wfJitter = (seed % 17) / 100; // 0–0.16
  const skJitter = ((seed >>> 8) % 13) / 100;
  const tech = (a.pas + a.dri) / 2;
  const weakFoot = clampStar(tech / 18 + wfJitter * 5);
  const skillMoves = clampStar((a.dri * 0.7 + a.pac * 0.3) / 18 + skJitter * 5);

  return {
    archetype,
    signature,
    weakFoot,
    skillMoves,
    workRate: {
      attack: workBand((a.pac + a.sho + a.phy) / 3),
      defense: workBand((a.def + a.phy + a.pac) / 3),
    },
    formationFits: formationFits(card.position, a),
    influence: {
      attack: Math.round((a.sho * 0.5 + a.pac * 0.3 + a.dri * 0.2)),
      press: Math.round((a.pac * 0.45 + a.phy * 0.35 + a.def * 0.2)),
      passing: Math.round((a.pas * 0.7 + a.dri * 0.3)),
      defense: Math.round((a.def * 0.65 + a.phy * 0.35)),
      aerial: Math.round((a.phy * 0.6 + a.sho * 0.25 + a.pas * 0.15)),
    },
  };
}

export function starsHtml(n: number): string {
  const full = "★".repeat(n);
  const empty = "☆".repeat(Math.max(0, 5 - n));
  return `${full}${empty}`;
}

export function signatureGlyph(sig: SignatureMove): string {
  const map: Record<SignatureMove, string> = {
    "Curved Runs": "↗",
    "Long Shot": "◎",
    "Through Ball": "⟶",
    "Aggressive Tackle": "⬡",
    "Aerial Threat": "⌃",
    "Explosive Pace": "»",
    "Close Control": "◉",
    "Set-Piece Threat": "◷",
    "Box Presence": "▣",
    Distribution: "⇄",
    Sweeping: "⌒",
    "Press Trigger": "⚡",
  };
  return map[sig] ?? "•";
}
