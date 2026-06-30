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

export interface DecisionResult {
  scenarioId: string;
  choice: DecisionId;
  success: boolean;
  outcome: string;
  explanation: string;
  wasOptimal: boolean;
  xpEarned: number;
}

export function resolveDecision(scenario: FootballIQScenario, choice: DecisionId): DecisionResult {
  const option = scenario.options.find((o) => o.id === choice);
  if (!option) throw new Error("Invalid choice");
  const roll = Math.random();
  const success = roll < option.successRate;
  const wasOptimal = choice === scenario.bestChoice;
  const best = scenario.options.find((o) => o.id === scenario.bestChoice)!;
  let explanation = option.explanation;
  if (!wasOptimal) {
    explanation += ` Better choice: ${best.label}. ${best.explanation}`;
  }
  const xpEarned = (success ? 20 : 5) + (wasOptimal ? 30 : 0);
  return {
    scenarioId: scenario.id,
    choice,
    success,
    outcome: success ? option.outcome : `Failed — ${option.outcome}`,
    explanation,
    wasOptimal,
    xpEarned,
  };
}

export const FOOTBALL_IQ_SCENARIOS: FootballIQScenario[] = [
  {
    id: "fiq-1",
    title: "Breakaway chance",
    minute: 67,
    difficulty: "beginner",
    context: "Your striker is 1v1 with the keeper. Defender closing from behind.",
    timeLimitSec: 4,
    bestChoice: "shoot",
    options: [
      {
        id: "shoot",
        label: "Shoot",
        successRate: 0.72,
        outcome: "Low shot beats the keeper!",
        explanation: "1v1 vs keeper — shoot early before the defender recovers.",
        xpBonus: 30,
      },
      {
        id: "pass_left",
        label: "Pass left",
        successRate: 0.35,
        outcome: "Pass intercepted — no teammate in support.",
        explanation: "No supporting runner; passing invites a tackle.",
        xpBonus: 5,
      },
      {
        id: "cut_inside",
        label: "Cut inside",
        successRate: 0.55,
        outcome: "Defender blocks after a heavy touch.",
        explanation: "Extra touches allow the recovering defender to commit.",
        xpBonus: 10,
      },
      {
        id: "through_ball",
        label: "Through ball",
        successRate: 0.1,
        outcome: "No runner — ball runs to the keeper.",
        explanation: "Through balls need a forward run; yours is isolated.",
        xpBonus: 0,
      },
      {
        id: "cross",
        label: "Cross",
        successRate: 0.08,
        outcome: "Impossible angle — cleared.",
        explanation: "Wide angle with no targets in the box.",
        xpBonus: 0,
      },
    ],
  },
  {
    id: "fiq-2",
    title: "Wide overload",
    minute: 34,
    difficulty: "beginner",
    context: "Winger beats his man. Two defenders in the box. Striker near penalty spot.",
    timeLimitSec: 4,
    bestChoice: "cross",
    options: [
      {
        id: "cross",
        label: "Cross",
        successRate: 0.68,
        outcome: "Striker heads home from six yards!",
        explanation: "Low driven cross beats the near-post defender.",
        xpBonus: 30,
      },
      {
        id: "shoot",
        label: "Shoot",
        successRate: 0.22,
        outcome: "Shot deflected for a corner.",
        explanation: "Tight angle — low percentage vs a set defence.",
        xpBonus: 5,
      },
      {
        id: "cut_inside",
        label: "Cut inside",
        successRate: 0.45,
        outcome: "Shot blocked by sliding centre-back.",
        explanation: "Cutting inside invites an extra body.",
        xpBonus: 10,
      },
      {
        id: "pass_left",
        label: "Pass left",
        successRate: 0.4,
        outcome: "Lay-off recycled but chance gone.",
        explanation: "Safe but slows the attack; defenders recover.",
        xpBonus: 8,
      },
      {
        id: "through_ball",
        label: "Through ball",
        successRate: 0.15,
        outcome: "Offside flag — mistimed run.",
        explanation: "Runner started early; linesman correct.",
        xpBonus: 0,
      },
    ],
  },
  {
    id: "fiq-3",
    title: "Counter press",
    minute: 78,
    difficulty: "professional",
    context: "You win the ball in midfield. Two runners ahead. High defensive line.",
    timeLimitSec: 4,
    bestChoice: "through_ball",
    options: [
      {
        id: "through_ball",
        label: "Through ball",
        successRate: 0.58,
        outcome: "Runner is clean through on goal!",
        explanation: "Immediate vertical pass exploits the high line before it drops.",
        xpBonus: 30,
      },
      {
        id: "pass_left",
        label: "Ground pass wide",
        successRate: 0.62,
        outcome: "Safe progression but defence resets.",
        explanation: "Safer but slower — gegenpress recovers shape.",
        xpBonus: 15,
      },
      {
        id: "shoot",
        label: "Shoot from distance",
        successRate: 0.12,
        outcome: "Easy save for the keeper.",
        explanation: "35 yards out with bodies ahead — low xG.",
        xpBonus: 0,
      },
      {
        id: "cut_inside",
        label: "Carry forward",
        successRate: 0.4,
        outcome: "Tackled by recovering midfielder.",
        explanation: "Carrying allows press traps to reform.",
        xpBonus: 8,
      },
      {
        id: "cross",
        label: "Switch play",
        successRate: 0.35,
        outcome: "Long ball overhit.",
        explanation: "Switch takes too long — offside trap resets.",
        xpBonus: 5,
      },
    ],
  },
  {
    id: "fiq-4",
    title: "Offside trap",
    minute: 55,
    difficulty: "elite",
    context: "Opponent plays a ball in behind. Your line stepped up. Striker timing the run.",
    timeLimitSec: 4,
    bestChoice: "pass_left",
    options: [
      {
        id: "pass_left",
        label: "Hold line — let offside",
        successRate: 0.75,
        outcome: "Flag up — perfectly timed trap!",
        explanation: "Maintaining the line catches the runner offside.",
        xpBonus: 30,
      },
      {
        id: "through_ball",
        label: "Drop and chase",
        successRate: 0.35,
        outcome: "Striker clean through — goal.",
        explanation: "Dropping one defender plays them onside.",
        xpBonus: 0,
      },
      {
        id: "shoot",
        label: "Rush keeper",
        successRate: 0.2,
        outcome: "Chip over empty net — wrong read.",
        explanation: "Keeper rush only works if you win the race.",
        xpBonus: 5,
      },
      {
        id: "cut_inside",
        label: "Step up aggressively",
        successRate: 0.45,
        outcome: "Mixed line — one defender plays them on.",
        explanation: "Inconsistent line breaks the trap.",
        xpBonus: 8,
      },
      {
        id: "cross",
        label: "Clear long",
        successRate: 0.5,
        outcome: "Cleared but possession lost.",
        explanation: "Works but surrenders structure for a throw-in.",
        xpBonus: 10,
      },
    ],
  },
  {
    id: "fiq-5",
    title: "90th minute",
    minute: 90,
    difficulty: "legend",
    context: "Striker has the ball. Three defenders. Two passing lanes. One shooting lane. 4 seconds.",
    timeLimitSec: 4,
    bestChoice: "cut_inside",
    options: [
      {
        id: "cut_inside",
        label: "Cut inside onto strong foot",
        successRate: 0.52,
        outcome: "Curled shot into the far corner!",
        explanation: "Inside cut creates a shooting lane the block can't reach.",
        xpBonus: 30,
      },
      {
        id: "shoot",
        label: "Shoot early",
        successRate: 0.28,
        outcome: "Blocked by sliding centre-back.",
        explanation: "Straight shot into a set wall — predictable.",
        xpBonus: 5,
      },
      {
        id: "pass_left",
        label: "Pass left",
        successRate: 0.31,
        outcome: "Expected completion 31% — intercepted.",
        explanation: "Defender body angle blocks the lane. Ground pass was safer.",
        xpBonus: 8,
      },
      {
        id: "through_ball",
        label: "Through ball",
        successRate: 0.18,
        outcome: "Channel too narrow — cleared.",
        explanation: "Three defenders compress central lanes.",
        xpBonus: 0,
      },
      {
        id: "cross",
        label: "Cross",
        successRate: 0.15,
        outcome: "Defender heads clear.",
        explanation: "No aerial threat arriving — low reward cross.",
        xpBonus: 0,
      },
    ],
  },
];

export function getScenario(id: string): FootballIQScenario | undefined {
  return FOOTBALL_IQ_SCENARIOS.find((s) => s.id === id);
}
