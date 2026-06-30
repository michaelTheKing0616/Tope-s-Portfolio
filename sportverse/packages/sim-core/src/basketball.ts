export interface ShotParams {
  angle: number;
  arc: number;
  spin: number;
  timing: number;
}

export interface ShotResult {
  made: boolean;
  score: number;
  feedback: string;
  xp: number;
}

export function evaluateShot(params: ShotParams): ShotResult {
  const ideal = { angle: 48, arc: 45, spin: 0.6, timing: 0.85 };
  const dist =
    Math.abs(params.angle - ideal.angle) / 50 +
    Math.abs(params.arc - ideal.arc) / 50 +
    Math.abs(params.spin - ideal.spin) +
    Math.abs(params.timing - ideal.timing);
  const made = dist < 0.55;
  const score = Math.max(0, Math.round(1000 - dist * 400));
  const feedback = made
    ? `Swish! ${params.arc.toFixed(0)}° arc, ${(params.timing * 100).toFixed(0)}% timing — textbook mechanics.`
    : `Miss. Optimal release ~48°, arc ~45°. Your arc was ${params.arc.toFixed(0)}°.`;
  return { made, score, feedback, xp: Math.round(score / 15) };
}

export interface CourtRead {
  id: string;
  defense: string;
  correctPass: "left" | "right" | "skip" | "lob";
  explanation: string;
}

export const POINT_GUARD_SCENARIOS: CourtRead[] = [
  { id: "pg1", defense: "Help side loaded left. Corner open right.", correctPass: "right", explanation: "Skip pass to weak-side corner — highest expected points." },
  { id: "pg2", defense: "Drop coverage — big at rim.", correctPass: "lob", explanation: "Lob over drop for alley-oop opportunity." },
  { id: "pg3", defense: "Blitz trap top of key.", correctPass: "skip", explanation: "Skip pass before trap completes — advance ball." },
  { id: "pg4", defense: "Zone 2-3 — short corner open.", correctPass: "left", explanation: "Short corner flash — gap in zone." },
  { id: "pg5", defense: "Switch everything — mismatch on wing.", correctPass: "right", explanation: "Isolate mismatch on right wing." },
];

export function gradePointGuardRead(scenario: CourtRead, choice: CourtRead["correctPass"]): {
  correct: boolean;
  score: number;
  explanation: string;
  xp: number;
} {
  const correct = choice === scenario.correctPass;
  return {
    correct,
    score: correct ? 750 : 150,
    explanation: scenario.explanation,
    xp: correct ? 45 : 8,
  };
}

export interface DraftProspect {
  id: string;
  name: string;
  position: string;
  scouting: string;
  hidden: { ceiling: number; injury: number; leadership: number; clutch: number };
}

export const DRAFT_CLASS: DraftProspect[] = [
  { id: "d1", name: "Prospect A", position: "PG", scouting: "Elite court vision, questionable jumper.", hidden: { ceiling: 88, injury: 20, leadership: 75, clutch: 70 } },
  { id: "d2", name: "Prospect B", position: "C", scouting: "Rim protector, limited range.", hidden: { ceiling: 82, injury: 35, leadership: 60, clutch: 55 } },
  { id: "d3", name: "Prospect C", position: "SG", scouting: "Volume scorer, defensive questions.", hidden: { ceiling: 90, injury: 45, leadership: 50, clutch: 85 } },
];

export function scoreDraftPicks(picks: string[], capSpace: number): {
  teamScore: number;
  capUsed: number;
  revealed: DraftProspect[];
  xp: number;
} {
  const revealed = picks.map((id) => DRAFT_CLASS.find((p) => p.id === id)!).filter(Boolean);
  const teamScore = revealed.reduce((s, p) => s + p.hidden.ceiling - p.hidden.injury / 2 + p.hidden.clutch / 3, 0);
  const capUsed = picks.length * 8_000_000;
  const capOk = capUsed <= capSpace;
  return {
    teamScore: Math.round(teamScore * (capOk ? 1 : 0.7)),
    capUsed,
    revealed,
    xp: Math.round(teamScore / 5),
  };
}
