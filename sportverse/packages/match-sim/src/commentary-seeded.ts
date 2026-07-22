import type { PlayerSeasonStat } from "@sportverse/sports-db";

export interface PlayerCommentaryProfile {
  goalsPer90: number;
  assistsPer90: number;
  appearances: number;
  minutes: number;
  wcGoals: number;
  wcApps: number;
  clubGoals: number;
  isGoalkeeper: boolean;
  peakSeasonGoals: number;
  peakSeasonLabel: string;
  primaryClub: string;
}

function competitionLabel(id: string): string {
  return id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function buildCommentaryProfile(
  stats: PlayerSeasonStat[],
  isGoalkeeper = false,
): PlayerCommentaryProfile {
  if (!stats.length) {
    return {
      goalsPer90: 0,
      assistsPer90: 0,
      appearances: 0,
      minutes: 0,
      wcGoals: 0,
      wcApps: 0,
      clubGoals: 0,
      isGoalkeeper,
      peakSeasonGoals: 0,
      peakSeasonLabel: "",
      primaryClub: "",
    };
  }

  const totals = stats.reduce(
    (acc, row) => ({
      goals: acc.goals + row.goals,
      assists: acc.assists + row.assists,
      minutes: acc.minutes + row.minutes,
      apps: acc.apps + row.appearances,
      wcGoals:
        acc.wcGoals +
        (row.context === "NATIONAL_TEAM" && /world-cup/i.test(row.competitionId) ? row.goals : 0),
      wcApps:
        acc.wcApps +
        (row.context === "NATIONAL_TEAM" && /world-cup/i.test(row.competitionId) ? row.appearances : 0),
      clubGoals: acc.clubGoals + (row.context === "CLUB" ? row.goals : 0),
    }),
    { goals: 0, assists: 0, minutes: 0, apps: 0, wcGoals: 0, wcApps: 0, clubGoals: 0 },
  );

  const minutes = Math.max(totals.minutes, totals.apps * 70, 1);

  let peakSeasonGoals = 0;
  let peakSeasonLabel = "";
  const bySeason = new Map<string, number>();
  for (const row of stats.filter((s) => s.context === "CLUB")) {
    bySeason.set(row.seasonLabel, (bySeason.get(row.seasonLabel) ?? 0) + row.goals);
  }
  for (const [season, goals] of bySeason) {
    if (goals > peakSeasonGoals) {
      peakSeasonGoals = goals;
      peakSeasonLabel = season;
    }
  }

  const clubMinutes = new Map<string, number>();
  for (const row of stats.filter((s) => s.context === "CLUB")) {
    clubMinutes.set(row.competitionId, (clubMinutes.get(row.competitionId) ?? 0) + row.minutes);
  }
  let primaryClub = "";
  let bestMin = 0;
  for (const [club, mins] of clubMinutes) {
    if (mins > bestMin) {
      bestMin = mins;
      primaryClub = competitionLabel(club);
    }
  }

  return {
    goalsPer90: (totals.goals / minutes) * 90,
    assistsPer90: (totals.assists / minutes) * 90,
    appearances: totals.apps,
    minutes: totals.minutes,
    wcGoals: totals.wcGoals,
    wcApps: totals.wcApps,
    clubGoals: totals.clubGoals,
    isGoalkeeper,
    peakSeasonGoals,
    peakSeasonLabel,
    primaryClub,
  };
}

export function seededGoalCommentary(
  playerName: string,
  minute: number,
  profile: PlayerCommentaryProfile,
): string {
  const min = `${minute}'`;

  if (profile.isGoalkeeper) {
    return `${min} GOAL! ${playerName} — unlikely but they'll take it!`;
  }
  if (profile.wcGoals >= 5 && profile.wcApps >= 10) {
    return `${min} GOAL! ${playerName} — ${profile.wcGoals} World Cup goals on the résumé, and another here!`;
  }
  if (profile.peakSeasonGoals >= 25 && profile.peakSeasonLabel) {
    return `${min} GOAL! ${playerName} — reminiscent of that ${profile.peakSeasonGoals}-goal ${profile.peakSeasonLabel} campaign.`;
  }
  if (profile.goalsPer90 >= 0.75) {
    return `${min} GOAL! ${playerName} — ${profile.appearances}+ career apps and they finish like a natural striker (${profile.goalsPer90.toFixed(2)} G/90).`;
  }
  if (profile.goalsPer90 >= 0.45) {
    return `${min} GOAL! Clinical from ${playerName} — that's what ${profile.goalsPer90.toFixed(2)} goals per 90 looks like.`;
  }
  if (profile.assistsPer90 >= 0.35 && profile.goalsPer90 < 0.2) {
    return `${min} GOAL! ${playerName} finally gets on the scoresheet — usually the provider at ${profile.assistsPer90.toFixed(2)} A/90.`;
  }
  if (profile.appearances >= 400) {
    return `${min} GOAL! ${playerName} — veteran quality on the biggest stage.`;
  }
  if (profile.primaryClub) {
    return `${min} GOAL! ${playerName} — ${profile.clubGoals} club goals in the archive, and one more today.`;
  }
  return `${min} GOAL! ${playerName} finds the net!`;
}

export function seededChanceCommentary(
  playerName: string,
  minute: number,
  profile: PlayerCommentaryProfile,
): string {
  const min = `${minute}'`;
  if (profile.goalsPer90 >= 0.6) {
    return `${min} ${playerName} — you expect better from a ${profile.goalsPer90.toFixed(2)} goals/90 finisher.`;
  }
  if (profile.peakSeasonGoals >= 20) {
    return `${min} ${playerName} squanders one — they've managed ${profile.peakSeasonGoals} in a season before.`;
  }
  if (profile.isGoalkeeper) {
    return `${min} ${playerName} tries a long-range effort — ambitious from the keeper.`;
  }
  return `${min} ${playerName} fires wide.`;
}

export function seededSaveCommentary(
  playerName: string,
  minute: number,
  profile: PlayerCommentaryProfile,
): string {
  const min = `${minute}'`;
  if (profile.isGoalkeeper) {
    return `${min} Superb stop! ${playerName} reads it like a shot-stopper should.`;
  }
  if (profile.goalsPer90 >= 0.5) {
    return `${min} Denied! The keeper keeps out ${playerName}'s trademark finish (${profile.goalsPer90.toFixed(2)} G/90).`;
  }
  if (profile.wcGoals >= 3) {
    return `${min} Saved! Even World Cup marksmen like ${playerName} can be stopped.`;
  }
  return `${min} Saved! ${playerName} denied.`;
}

export function seededCardCommentary(
  playerName: string,
  minute: number,
  profile: PlayerCommentaryProfile,
  red: boolean,
): string {
  const min = `${minute}'`;
  if (red) {
    if (profile.appearances >= 500) {
      return `${min} RED CARD — ${playerName} walks after a rash moment; ${profile.appearances}+ apps of experience won't save them.`;
    }
    return `${min} RED CARD — ${playerName} sent off!`;
  }
  if (profile.minutes >= 30000) {
    return `${min} Yellow card for ${playerName} — a veteran with ${Math.round(profile.minutes / 90)}+ ninety-minute equivalents on the clock.`;
  }
  return `${min} Yellow card for ${playerName}.`;
}

export function seededInjuryCommentary(
  playerName: string,
  minute: number,
  profile: PlayerCommentaryProfile,
): string {
  const min = `${minute}'`;
  if (profile.appearances >= 300) {
    return `${min} ${playerName} forced off — the body betraying a player with ${profile.appearances}+ logged appearances.`;
  }
  return `${min} ${playerName} forced off — injury in heavy conditions.`;
}

export function seededFatigueCommentary(playerName: string, minute: number, profile: PlayerCommentaryProfile): string {
  const min = `${minute}'`;
  if (profile.minutes >= 25000) {
    return `${min} ${playerName} is starting to feel the pace — mileage from ${Math.round(profile.minutes / 90)}+ ninety-minute equivalents showing.`;
  }
  return `${min} ${playerName} is starting to feel the pace of this one.`;
}

export function seededKickoffCommentary(eraLabel: string, homeName: string, awayName: string): string {
  return `Kick-off — ${homeName} vs ${awayName} under ${eraLabel} conditions.`;
}

export function seededFulltimeCommentary(homeName: string, awayName: string, homeGoals: number, awayGoals: number): string {
  if (homeGoals === awayGoals) {
    return `Full time — ${homeGoals}-${awayGoals}. ${homeName} and ${awayName} share the points.`;
  }
  const winner = homeGoals > awayGoals ? homeName : awayName;
  const loser = homeGoals > awayGoals ? awayName : homeName;
  return `Full time — ${homeGoals}-${awayGoals}. ${winner} take it; ${loser} left to reflect.`;
}

export function seededBigChanceCommentary(
  playerName: string,
  minute: number,
  profile: PlayerCommentaryProfile,
  xg?: number,
): string {
  const min = `${minute}'`;
  const quality = xg !== undefined && xg >= 0.45 ? "gilt-edged" : "huge";
  if (profile.goalsPer90 >= 0.6) {
    return `${min} ${quality} chance! ${playerName} — how did that stay out?`;
  }
  if (profile.peakSeasonGoals >= 20) {
    return `${min} ${quality} chance for ${playerName} — the kind of moment they thrived on in ${profile.peakSeasonLabel || "their peak"}.`;
  }
  return `${min} ${quality} chance! ${playerName} can't believe it.`;
}

export function seededFulltimePulseCommentary(
  homeName: string,
  awayName: string,
  homeGoals: number,
  awayGoals: number,
  stats: {
    possessionHome: number;
    possessionAway: number;
    xGHome: number;
    xGAway: number;
    shotsHome: number;
    shotsAway: number;
    bigChancesHome: number;
    bigChancesAway: number;
  },
): string {
  const scoreLine = `${homeGoals}-${awayGoals}`;
  const xgStory =
    stats.xGHome > stats.xGAway + 0.4 && homeGoals <= awayGoals
      ? ` ${homeName} dominated the chances (${stats.xGHome.toFixed(1)}–${stats.xGAway.toFixed(1)} xG) but not the scoreboard.`
      : stats.xGAway > stats.xGHome + 0.4 && awayGoals <= homeGoals
        ? ` ${awayName} created more (${stats.xGAway.toFixed(1)} xG) yet leave empty-handed.`
        : ` Chance map ${stats.xGHome.toFixed(1)}–${stats.xGAway.toFixed(1)} xG · ${stats.possessionHome}–${stats.possessionAway}% possession.`;
  if (homeGoals === awayGoals) {
    return `Full time — ${scoreLine}.${xgStory}`;
  }
  const winner = homeGoals > awayGoals ? homeName : awayName;
  const lateDrama =
    Math.abs(homeGoals - awayGoals) === 1 && Math.max(stats.bigChancesHome, stats.bigChancesAway) >= 2
      ? ` A game of nerves — ${stats.bigChancesHome + stats.bigChancesAway} big chances in total.`
      : "";
  return `Full time — ${scoreLine}. ${winner} take the points.${xgStory}${lateDrama}`;
}
