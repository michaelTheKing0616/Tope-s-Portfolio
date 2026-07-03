/**
 * Layman season prediction — superficial squad OVR appraisal before full simulation.
 * Contrasts with simulateSeason which applies era fit, fatigue, Dixon–Coles, etc.
 */

import type { RatedPlayerCard, SeasonExpectationGrade, SeasonPrediction, SeasonSimResult } from "@sportverse/draftballer-types";
import { SEASON_LENGTH } from "./season.js";

/** Heuristic league table projection from raw squad strength only. */
export function predictSeasonOutlook(
  squad: { players: RatedPlayerCard[]; squadOvr: number; name?: string },
  opponentAvgOvr = 72,
): SeasonPrediction {
  const xi = squad.players.slice(0, 11);
  const avgOvr = xi.length
    ? Math.round(xi.reduce((s, p) => s + p.ovr, 0) / xi.length)
    : squad.squadOvr;
  const topThree = [...xi].sort((a, b) => b.ovr - a.ovr).slice(0, 3);
  const starGap = topThree.length >= 2 ? topThree[0]!.ovr - topThree[2]!.ovr : 0;

  const attack = avgOvr + starGap * 0.15;
  const defense = avgOvr - (squad.squadOvr - avgOvr) * 0.2;
  const strengthDelta = (attack + defense) / 2 - opponentAvgOvr;

  const expectedWins = Math.round(
    SEASON_LENGTH * clamp(0.15 + 0.028 * strengthDelta + starGap * 0.004, 0.08, 0.78),
  );
  const expectedDraws = Math.round(SEASON_LENGTH * clamp(0.22 - strengthDelta * 0.004, 0.1, 0.35));
  const expectedLosses = Math.max(0, SEASON_LENGTH - expectedWins - expectedDraws);
  const expectedPoints = expectedWins * 3 + expectedDraws;
  const expectedGd = Math.round(strengthDelta * SEASON_LENGTH * 0.35);

  const tier = outlookTier(expectedPoints);
  const headline = outlookHeadline(tier, squad.name ?? "Your XI", expectedPoints);
  const narrative = buildNarrative(tier, avgOvr, strengthDelta, topThree);

  return {
    expectedWins,
    expectedDraws,
    expectedLosses,
    expectedPoints,
    expectedGoalsFor: Math.round(SEASON_LENGTH * clamp(1.15 + strengthDelta * 0.04, 0.7, 2.8)),
    expectedGoalsAgainst: Math.round(SEASON_LENGTH * clamp(1.15 - strengthDelta * 0.035, 0.6, 2.5)),
    expectedGoalDifference: expectedGd,
    squadOvr: squad.squadOvr,
    avgXiOvr: avgOvr,
    opponentAvgOvr,
    starPlayerName: topThree[0]?.name,
    starPlayerOvr: topThree[0]?.ovr,
    outlookTier: tier,
    headline,
    narrative,
    disclaimer:
      "This preview uses squad overalls only — like a pundit's hot take. The full simulation weighs era fit, tactics, fatigue, and match-by-match variance.",
  };
}

export function gradeSeasonVsPrediction(
  actual: SeasonSimResult,
  prediction: SeasonPrediction,
): SeasonExpectationGrade {
  const pointsDelta = actual.points - prediction.expectedPoints;
  const gdDelta = actual.goalDifference - prediction.expectedGoalDifference;
  const winsDelta = actual.won - prediction.expectedWins;

  let grade: SeasonExpectationGrade["grade"];
  let label: string;
  let summary: string;

  if (pointsDelta >= 12 || (pointsDelta >= 8 && gdDelta >= 10)) {
    grade = "exceeded";
    label = "Exceeded Expectations";
    summary = `You picked up ${pointsDelta >= 0 ? "+" : ""}${pointsDelta} points versus the pre-season call — the full simulation rewarded quality the raw numbers undersold.`;
  } else if (pointsDelta >= 5 || (pointsDelta >= 3 && winsDelta >= 2)) {
    grade = "overperformed";
    label = "Overperformed";
    summary = `A solid ${actual.points}-point return beat our ${prediction.expectedPoints}-point preview. Era fit, tactics, or standout performances made the difference.`;
  } else if (pointsDelta <= -12 || (pointsDelta <= -8 && gdDelta <= -10)) {
    grade = "underwhelmed";
    label = "Well Below Expectations";
    summary = `The season fell ${Math.abs(pointsDelta)} points short of the preview. Injuries, fatigue, or tactical mismatches likely hurt more than the squad sheet suggested.`;
  } else if (pointsDelta <= -5 || (pointsDelta <= -3 && winsDelta <= -2)) {
    grade = "underperformed";
    label = "Underperformed";
    summary = `Finished on ${actual.points} pts vs an expected ${prediction.expectedPoints}. The deeper simulation exposed gaps the headline OVR masked.`;
  } else if (Math.abs(pointsDelta) <= 2 && Math.abs(gdDelta) <= 4) {
    grade = "met";
    label = "Met Expectations";
    summary = `Essentially the season the superficial read predicted — ${actual.won}W-${actual.drawn}D-${actual.lost}L landed near the preview.`;
  } else if (pointsDelta > 0) {
    grade = "slightly_above";
    label = "Slightly Above Expectations";
    summary = `A modest overachievement (+${pointsDelta} pts). The squad did a touch more than the raw ratings implied.`;
  } else {
    grade = "slightly_below";
    label = "Slightly Below Expectations";
    summary = `A narrow miss (${pointsDelta} pts vs preview). Close enough that variance, not quality, explains most of the gap.`;
  }

  return {
    grade,
    label,
    summary,
    pointsDelta,
    goalDifferenceDelta: gdDelta,
    winsDelta,
    prediction,
    actualPoints: actual.points,
    actualRecord: `${actual.won}W-${actual.drawn}D-${actual.lost}L`,
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function outlookTier(expectedPoints: number): SeasonPrediction["outlookTier"] {
  if (expectedPoints >= 82) return "title_challenger";
  if (expectedPoints >= 68) return "european_push";
  if (expectedPoints >= 52) return "mid_table";
  if (expectedPoints >= 38) return "survival_scrap";
  return "relegation_battle";
}

function outlookHeadline(
  tier: SeasonPrediction["outlookTier"],
  squadName: string,
  pts: number,
): string {
  switch (tier) {
    case "title_challenger":
      return `${squadName} look like genuine title contenders on paper (~${pts} pts).`;
    case "european_push":
      return `${squadName} should push for Europe if the big names turn up (~${pts} pts).`;
    case "mid_table":
      return `${squadName} profile as a solid mid-table side (~${pts} pts).`;
    case "survival_scrap":
      return `${squadName} may spend the year looking over their shoulder (~${pts} pts).`;
    default:
      return `${squadName} look vulnerable on raw ratings alone (~${pts} pts).`;
  }
}

function buildNarrative(
  tier: SeasonPrediction["outlookTier"],
  avgOvr: number,
  strengthDelta: number,
  stars: RatedPlayerCard[],
): string {
  const starLine = stars.length
    ? `Headline act: ${stars[0]!.name} (${stars[0]!.ovr} OVR)${stars[1] ? ` with ${stars[1].name} (${stars[1].ovr}) in support` : ""}.`
    : "";
  const deltaLine =
    strengthDelta > 4
      ? "The XI averages well above typical opposition — pundits would back you for consistent wins."
      : strengthDelta > 1
        ? "Squad quality edges most opponents, but nothing here guarantees blowouts."
        : strengthDelta > -2
          ? "Ratings suggest a coin-flip league campaign — fine margins everywhere."
          : "On paper you're out-gunned most weeks. You'll need the sim engine to find upsets.";
  return [starLine, deltaLine, `Starting XI average: ${avgOvr} OVR.`].filter(Boolean).join(" ");
}
