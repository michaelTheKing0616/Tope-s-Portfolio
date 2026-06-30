export type DiveDirection = "left" | "center" | "right";

export interface StrikerCues {
  footAngle: "left" | "right" | "center";
  shoulderOpen: boolean;
  eyesLook: DiveDirection;
  runSpeed: "slow" | "medium" | "fast";
  fakes: boolean;
}

export interface GoalkeeperLevel {
  id: number;
  title: string;
  cues: StrikerCues;
  actualShot: DiveDirection;
  telegraphStrength: number;
  description: string;
}

export interface SaveResult {
  levelId: number;
  guess: DiveDirection;
  actual: DiveDirection;
  saved: boolean;
  xpEarned: number;
  readAccuracy: number;
  explanation: string;
}

/** Weighted prediction from body-language cues. */
export function predictFromCues(cues: StrikerCues): Record<DiveDirection, number> {
  const weights: Record<DiveDirection, number> = { left: 0.33, center: 0.34, right: 0.33 };

  if (cues.footAngle === "left") {
    weights.left += 0.25;
    weights.right -= 0.1;
  } else if (cues.footAngle === "right") {
    weights.right += 0.25;
    weights.left -= 0.1;
  }

  if (cues.shoulderOpen) weights[cues.eyesLook] += 0.15;

  if (cues.eyesLook === "left") weights.left += 0.2;
  else if (cues.eyesLook === "right") weights.right += 0.2;
  else weights.center += 0.15;

  if (cues.runSpeed === "fast") weights.center += 0.05;

  if (cues.fakes) {
    weights.left *= 0.85;
    weights.right *= 0.85;
    weights.center += 0.1;
  }

  const sum = weights.left + weights.center + weights.right;
  return {
    left: weights.left / sum,
    center: weights.center / sum,
    right: weights.right / sum,
  };
}

export function resolveSave(level: GoalkeeperLevel, guess: DiveDirection): SaveResult {
  const saved = guess === level.actualShot;
  const preds = predictFromCues(level.cues);
  const readAccuracy = Math.round(preds[level.actualShot] * 100);
  const xpEarned = saved ? 25 + level.id * 2 : 5;
  const explanation = level.cues.fakes
    ? "The striker faked — eyes deceived. Trust foot angle over gaze at higher levels."
    : `Foot angle and shoulder position suggested ${level.actualShot}. Real keepers read these cues.`;

  return { levelId: level.id, guess, actual: level.actualShot, saved, xpEarned, readAccuracy, explanation };
}

function level(
  id: number,
  title: string,
  cues: StrikerCues,
  actualShot: DiveDirection,
  telegraphStrength: number,
  description: string,
): GoalkeeperLevel {
  return { id, title, cues, actualShot, telegraphStrength, description };
}

export const GOALKEEPER_LEVELS: GoalkeeperLevel[] = [
  level(1, "Open body", { footAngle: "right", shoulderOpen: true, eyesLook: "right", runSpeed: "medium", fakes: false }, "right", 0.9, "Clear telegraph — shoot right."),
  level(2, "Left foot set", { footAngle: "left", shoulderOpen: true, eyesLook: "left", runSpeed: "slow", fakes: false }, "left", 0.85, "Plant foot points left."),
  level(3, "Central run", { footAngle: "center", shoulderOpen: false, eyesLook: "center", runSpeed: "fast", fakes: false }, "center", 0.8, "Straight approach — power down the middle."),
  level(4, "Look right, shoot left", { footAngle: "left", shoulderOpen: true, eyesLook: "right", runSpeed: "medium", fakes: false }, "left", 0.6, "Eyes wrong — foot honest."),
  level(5, "Shoulder closed", { footAngle: "right", shoulderOpen: false, eyesLook: "right", runSpeed: "medium", fakes: false }, "right", 0.7, "Closed shoulder hides curl."),
  level(6, "Fast approach", { footAngle: "left", shoulderOpen: true, eyesLook: "left", runSpeed: "fast", fakes: false }, "left", 0.75, "Speed limits placement options."),
  level(7, "Subtle fake", { footAngle: "right", shoulderOpen: true, eyesLook: "left", runSpeed: "medium", fakes: true }, "right", 0.45, "First fake — trust the plant foot."),
  level(8, "Eyes deceive", { footAngle: "center", shoulderOpen: true, eyesLook: "right", runSpeed: "slow", fakes: true }, "center", 0.4, "Panenka mind game."),
  level(9, "Late stutter", { footAngle: "left", shoulderOpen: false, eyesLook: "center", runSpeed: "slow", fakes: true }, "left", 0.35, "Stutter step — read the hips."),
  level(10, "Pro penalty", { footAngle: "right", shoulderOpen: true, eyesLook: "left", runSpeed: "fast", fakes: true }, "right", 0.3, "Full mind game — foot wins."),
  level(11, "Wide angle", { footAngle: "left", shoulderOpen: true, eyesLook: "left", runSpeed: "medium", fakes: false }, "left", 0.65, "Angle forces near post."),
  level(12, "Keeper rush", { footAngle: "center", shoulderOpen: false, eyesLook: "center", runSpeed: "fast", fakes: false }, "center", 0.55, "Chip threat — stay central."),
  level(13, "Double fake", { footAngle: "right", shoulderOpen: true, eyesLook: "left", runSpeed: "slow", fakes: true }, "left", 0.25, "Double body feint — ignore eyes."),
  level(14, "Power vs placement", { footAngle: "right", shoulderOpen: false, eyesLook: "right", runSpeed: "fast", fakes: false }, "right", 0.5, "Power shot — commit early."),
  level(15, "Mind games", { footAngle: "left", shoulderOpen: true, eyesLook: "right", runSpeed: "medium", fakes: true }, "left", 0.28, "Elite — composite read required."),
  level(16, "Late shift", { footAngle: "center", shoulderOpen: true, eyesLook: "left", runSpeed: "slow", fakes: true }, "right", 0.22, "Last-second shift to right."),
  level(17, "Instinct only", { footAngle: "right", shoulderOpen: false, eyesLook: "center", runSpeed: "fast", fakes: true }, "center", 0.2, "Minimal telegraph."),
  level(18, "Legend tier", { footAngle: "left", shoulderOpen: true, eyesLook: "right", runSpeed: "fast", fakes: true }, "right", 0.18, "Opposite every cue."),
  level(19, "Chaos", { footAngle: "center", shoulderOpen: true, eyesLook: "left", runSpeed: "fast", fakes: true }, "left", 0.15, "Trust biomechanics only."),
  level(20, "Ultimate", { footAngle: "right", shoulderOpen: true, eyesLook: "left", runSpeed: "medium", fakes: true }, "center", 0.12, "Panenka under max pressure."),
];

export function getGoalkeeperLevel(id: number): GoalkeeperLevel | undefined {
  return GOALKEEPER_LEVELS.find((l) => l.id === id);
}
