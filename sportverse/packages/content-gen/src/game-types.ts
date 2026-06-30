export type DecisionId = "shoot" | "pass_left" | "through_ball" | "cut_inside" | "cross";

export interface TacticalOption {
  id: DecisionId;
  label: string;
  successRate: number;
  outcome: string;
  explanation: string;
  xpBonus: number;
}

export interface FootballIQScenario {
  id: string;
  title: string;
  minute: number;
  difficulty: "beginner" | "professional" | "elite" | "legend";
  context: string;
  timeLimitSec: number;
  options: TacticalOption[];
  bestChoice: DecisionId;
}

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
