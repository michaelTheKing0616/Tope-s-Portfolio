import type { FootballIQResult, TacticalChoice, TacticalScenario } from "./types.js";

export const SCENARIOS: TacticalScenario[] = [
  {
    id: "sq1",
    title: "Late equaliser chance",
    minute: 90,
    context: "Your striker has the ball at the edge of the box. Three defenders block the shot lane. A teammate is free on the left.",
    timeLimitSec: 4,
    difficulty: "beginner",
    options: [
      { id: "shoot", label: "Shoot" },
      { id: "pass_left", label: "Pass left" },
      { id: "through_ball", label: "Through ball" },
      { id: "cut_inside", label: "Cut inside" },
      { id: "cross", label: "Cross" },
    ],
    bestChoice: "pass_left",
    outcomes: {
      shoot: {
        success: false,
        narrative: "Blocked. The crowded box swallows the shot.",
        explanation: "Shot lane blocked by three defenders. Expected completion ~12%. Ground pass left has ~68% to a free teammate.",
        xg: 0.08,
      },
      pass_left: {
        success: true,
        narrative: "Square ball. Left winger shoots — GOAL!",
        explanation: "Correct. Open teammate, better angle. Defender body angles favoured a pass, not a shot.",
        xg: 0.42,
      },
      through_ball: {
        success: false,
        narrative: "Intercepted. The line stepped up.",
        explanation: "Through ball into a compact back line. Offside trap risk was high.",
        xg: 0.05,
      },
      cut_inside: {
        success: false,
        narrative: "Tackled. No space to turn.",
        explanation: "Three defenders collapsed centrally. Cutting inside met immediate pressure.",
        xg: 0.06,
      },
      cross: {
        success: false,
        narrative: "Headed away. First defender attacked the cross.",
        explanation: "No aerial target in the box. Cross into traffic = low xG.",
        xg: 0.04,
      },
    },
  },
  {
    id: "sq2",
    title: "Counter-attack 3v2",
    minute: 67,
    context: "You lead a break: striker central, winger right, one defender between you and goal.",
    timeLimitSec: 4,
    difficulty: "professional",
    options: [
      { id: "shoot", label: "Shoot early" },
      { id: "pass_left", label: "Hold & recycle" },
      { id: "through_ball", label: "Through ball to winger" },
      { id: "cut_inside", label: "Drive at defender" },
      { id: "cross", label: "Wide cross" },
    ],
    bestChoice: "through_ball",
    outcomes: {
      shoot: {
        success: false,
        narrative: "Saved. Keeper read the early shot.",
        explanation: "Long-range shot with defender closing. xG ~0.09. Through ball exploits numerical advantage.",
        xg: 0.09,
      },
      pass_left: {
        success: false,
        narrative: "Momentum lost. Defence recovered.",
        explanation: "Recycling kills the counter. 3v2 windows close in seconds.",
        xg: 0.02,
      },
      through_ball: {
        success: true,
        narrative: "Winger in behind — one-on-one — scores!",
        explanation: "Perfect. Split the last defender. Highest xG option in a 3v2.",
        xg: 0.55,
      },
      cut_inside: {
        success: false,
        narrative: "Defender blocks. No foul.",
        explanation: "Driving centrally lets the recovering defender engage. Wide release was better.",
        xg: 0.11,
      },
      cross: {
        success: false,
        narrative: "Overhit. Goal kick.",
        explanation: "Winger was already ahead — cross was unnecessary.",
        xg: 0.03,
      },
    },
  },
  {
    id: "sq3",
    title: "Offside trap",
    minute: 34,
    context: "Opponent's line is high. Your runner is level with the last defender. Ball at your feet in midfield.",
    timeLimitSec: 4,
    difficulty: "elite",
    options: [
      { id: "shoot", label: "Long shot" },
      { id: "pass_left", label: "Safe pass wide" },
      { id: "through_ball", label: "Timed through ball" },
      { id: "cut_inside", label: "Carry forward" },
      { id: "cross", label: "Chip over the top" },
    ],
    bestChoice: "through_ball",
    outcomes: {
      shoot: {
        success: false,
        narrative: "Wide. No threat.",
        explanation: "Long shot from midfield ignores the offside trap opportunity.",
        xg: 0.03,
      },
      pass_left: {
        success: false,
        narrative: "Attack slows. Trap resets.",
        explanation: "Safe pass lets the line drop. Timing window lost.",
        xg: 0.01,
      },
      through_ball: {
        success: true,
        narrative: "Runner stays onside — clean through — goal!",
        explanation: "Timed release as the line stepped. Level at pass = onside.",
        xg: 0.48,
      },
      cut_inside: {
        success: false,
        narrative: "Caught offside on the carry.",
        explanation: "Carrying forward without releasing the runner wasted the run.",
        xg: 0,
      },
      cross: {
        success: false,
        narrative: "Offside. Flag up.",
        explanation: "Chip was early — runner hadn't timed the run.",
        xg: 0,
      },
    },
  },
  {
    id: "sq4",
    title: "Set piece overload",
    minute: 78,
    context: "Corner from the right. Six attackers in the box. Short corner option available.",
    timeLimitSec: 4,
    difficulty: "professional",
    options: [
      { id: "shoot", label: "Shoot from corner" },
      { id: "pass_left", label: "Short corner" },
      { id: "through_ball", label: "Near-post flick" },
      { id: "cut_inside", label: "Edge-of-box recycle" },
      { id: "cross", label: "Whipped cross" },
    ],
    bestChoice: "cross",
    outcomes: {
      shoot: {
        success: false,
        narrative: "First defender blocks. Corner wasted.",
        explanation: "Direct corner shots succeed <2% of the time.",
        xg: 0.02,
      },
      pass_left: {
        success: false,
        narrative: "Recycled but cleared.",
        explanation: "Short worked but second delivery was poor. Whipped first cross was higher xG.",
        xg: 0.08,
      },
      through_ball: {
        success: false,
        narrative: "Near-post run missed.",
        explanation: "Flick-on needed perfect connection. Insufficient service.",
        xg: 0.06,
      },
      cut_inside: {
        success: false,
        narrative: "Blocked. Counter launched.",
        explanation: "Recycling from the edge lost the set-piece advantage.",
        xg: 0.04,
      },
      cross: {
        success: true,
        narrative: "Near-post header — GOAL!",
        explanation: "Whipped delivery with pace. Six in the box = overload. Correct service.",
        xg: 0.18,
      },
    },
  },
  {
    id: "sq5",
    title: "Habit read — legend",
    minute: 88,
    context: "You've cut inside three times this half. The full-back is cheating inside. Winger is wide open.",
    timeLimitSec: 4,
    difficulty: "legend",
    options: [
      { id: "shoot", label: "Cut inside & shoot" },
      { id: "pass_left", label: "Pass to winger" },
      { id: "through_ball", label: "Diagonal switch" },
      { id: "cut_inside", label: "Cut inside again" },
      { id: "cross", label: "Low cross" },
    ],
    bestChoice: "pass_left",
    outcomes: {
      shoot: {
        success: false,
        narrative: "Predictable. Full-back blocks.",
        explanation: "AI read your habit. Fourth cut-inside was telegraphed. xG ~0.07.",
        xg: 0.07,
      },
      pass_left: {
        success: true,
        narrative: "Winger exploits space — assist!",
        explanation: "Correct. Defender overcommitted inside. Exploit the pattern you created.",
        xg: 0.38,
      },
      through_ball: {
        success: false,
        narrative: "Overhit switch.",
        explanation: "Diagonal was an option but winger was closer via simple pass.",
        xg: 0.05,
      },
      cut_inside: {
        success: false,
        narrative: "Tackled. Full-back anticipated.",
        explanation: "Legend difficulty: AI learns habits. Vary your patterns.",
        xg: 0.04,
      },
      cross: {
        success: false,
        narrative: "Deflected corner.",
        explanation: "Low cross into a set defence. Winger had more space wide.",
        xg: 0.06,
      },
    },
  },
];

export function getScenario(id: string): TacticalScenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

export function listScenarios(): TacticalScenario[] {
  return SCENARIOS;
}

export function resolveChoice(scenarioId: string, choice: TacticalChoice): FootballIQResult {
  const scenario = getScenario(scenarioId);
  if (!scenario) throw new Error("Scenario not found");
  const outcome = scenario.outcomes[choice];
  if (!outcome) throw new Error("Invalid choice");
  const optimal = choice === scenario.bestChoice;
  return {
    scenarioId,
    choice,
    outcome,
    optimal,
    xpEarned: optimal ? 60 : outcome.success ? 30 : 10,
  };
}
