/** Competition id helpers shared by filters and UCL mode. */
export function isContinentalCompetition(competitionId: string): boolean {
  return ["champions-league", "europa-league", "conference-league"].includes(competitionId);
}

export const CONTINENTAL_IDS = ["champions-league", "europa-league", "conference-league"] as const;
