export type TacticalChoice = "shoot" | "pass_left" | "through_ball" | "cut_inside" | "cross";

export interface ScenarioOption {
  id: TacticalChoice;
  label: string;
}

export interface TacticalScenario {
  id: string;
  title: string;
  minute: number;
  context: string;
  timeLimitSec: number;
  difficulty: "beginner" | "professional" | "elite" | "legend";
  options: ScenarioOption[];
  outcomes: Record<TacticalChoice, ScenarioOutcome>;
  bestChoice: TacticalChoice;
}

export interface ScenarioOutcome {
  success: boolean;
  narrative: string;
  explanation: string;
  xg?: number;
}

export interface FootballIQResult {
  scenarioId: string;
  choice: TacticalChoice;
  outcome: ScenarioOutcome;
  optimal: boolean;
  xpEarned: number;
}
