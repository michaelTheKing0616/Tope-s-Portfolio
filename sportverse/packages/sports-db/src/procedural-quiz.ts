/**
 * Procedural quiz content from the full extended database — infinite playability.
 * Every question is derived from real player/club/competition rows, not synthetic names.
 */
import type { CareerPathEntry, ExtendedPlayer, PlayerSeasonStat } from "./extended-types.js";
import type { CareerPathEntry, Club, Player, SpeedQuestion, TrueFalseStatement } from "./types.js";
import { getAwards, getClubsExtended, getCompetitions, getExtendedPlayers, getSeasonStats } from "./extended.js";
import { getCuratedCareerPaths, getCuratedSpeedQuestions, getCuratedTrueFalse } from "./curated.js";
import { resolveCompetitionToLeague } from "./league-resolver.js";

const YOUTH_MARKERS = /u\d{2}|youth|youth\.|sub-|jv|academy|b team|c team|reserve/i;

function cleanClubName(raw: string): string {
  return raw.replace(/\s+(FC|CF|SC|U\d+)$/i, "").trim();
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

function seniorClubsFromStats(stats: PlayerSeasonStat[]): string[] {
  const clubRows = stats.filter((s) => s.context === "CLUB" && !/world-cup|euro|qualif|copa|nations/i.test(s.competitionId));
  const bySeason = [...clubRows].sort((a, b) => Number(a.seasonLabel) - Number(b.seasonLabel));
  const clubs: string[] = [];
  for (const row of bySeason) {
    const league = resolveCompetitionToLeague(row.competitionId) ?? row.competitionId;
    const label = cleanClubName(row.competitionId.replace(/-/g, " "));
    if (YOUTH_MARKERS.test(label) || YOUTH_MARKERS.test(row.competitionId)) continue;
    if (!clubs.includes(label)) clubs.push(label);
    if (league !== row.competitionId && !clubs.includes(cleanClubName(league.replace(/-/g, " ")))) {
      clubs.push(cleanClubName(league.replace(/-/g, " ")));
    }
  }
  return unique(clubs).slice(0, 8);
}

function totalGoals(stats: PlayerSeasonStat[]): number {
  return stats.reduce((s, r) => s + r.goals, 0);
}

function totalApps(stats: PlayerSeasonStat[]): number {
  return stats.reduce((s, r) => s + r.appearances, 0);
}

function wcGoals(stats: PlayerSeasonStat[]): number {
  return stats
    .filter((s) => s.context === "NATIONAL_TEAM" && /world-cup/i.test(s.competitionId))
    .reduce((s, r) => s + r.goals, 0);
}

function primaryNation(nationality?: string): string | null {
  if (!nationality?.trim()) return null;
  return nationality.split(/\s+/)[0]!.replace(/[,;]/g, "");
}

function positionLabel(position?: string): string | null {
  if (!position?.trim()) return null;
  const p = position.toLowerCase();
  if (p.includes("goal")) return "goalkeeper";
  if (p.includes("centre-back") || p.includes("center-back") || p === "cb") return "centre-back";
  if (p.includes("back") || p.includes("wing-back")) return "full-back";
  if (p.includes("defensive mid")) return "defensive midfielder";
  if (p.includes("attacking mid")) return "attacking midfielder";
  if (p.includes("winger") || (p.includes("wing") && !p.includes("back"))) return "winger";
  if (p.includes("striker") || p.includes("second striker")) return "striker";
  if (p.includes("forward") || p.includes("attack")) return "forward";
  if (p.includes("mid")) return "midfielder";
  if (p.includes("def")) return "defender";
  return null;
}

function isBoilerplateClue(clue: string): boolean {
  return /^(professional record on file|transfermarkt profile|born \d{4})/i.test(clue.trim());
}

function peakSeason(stats: PlayerSeasonStat[]): PlayerSeasonStat | null {
  const club = stats.filter((s) => s.context === "CLUB" && s.appearances >= 5);
  if (!club.length) return null;
  return [...club].sort((a, b) => b.goals + b.assists - (a.goals + a.assists) || b.appearances - a.appearances)[0] ?? null;
}

/** Build progressive clues for Who Am I from real database fields (target 5–8). */
export function generatePlayerClues(player: Player, stats: PlayerSeasonStat[]): string[] {
  const clues: string[] = [];
  const nation = primaryNation(player.nationality);
  const pos = positionLabel(player.position);
  const clubs = (player.clubs?.length ? player.clubs : seniorClubsFromStats(stats))
    .filter((c) => c && !YOUTH_MARKERS.test(c) && !/^unknown$/i.test(c) && !/^---+$/.test(c))
    .slice(0, 6);
  const goals = totalGoals(stats);
  const apps = totalApps(stats);
  const assists = stats.reduce((s, r) => s + r.assists, 0);
  const wc = wcGoals(stats);
  const awards = getAwards().filter((a) => a.playerId === player.id);
  const peak = peakSeason(stats);
  const decades = (player as ExtendedPlayer).decades ?? [];

  // Progressive ladder: broad → specific. Order matters for scoring.
  if (nation) clues.push(`I represent ${nation} at international level.`);
  if (pos) clues.push(`My primary role on the pitch is ${pos}.`);
  if (decades[0]) clues.push(`My career is most often associated with the ${decades[0]}.`);
  if (clubs[0]) clues.push(`I have played senior football for ${clubs[0]}.`);
  if (clubs[1]) clues.push(`Another club on my résumé is ${clubs[1]}.`);
  if (goals >= 100) clues.push(`My database records show ${goals}+ career goals across logged competitions.`);
  else if (goals >= 20) clues.push(`I've scored ${goals} goals in competitions tracked in this archive.`);
  else if (goals >= 5) clues.push(`I've scored ${goals} goals in competitions tracked in this archive.`);
  if (assists >= 30) clues.push(`I've registered ${assists}+ assists in tracked competitions.`);
  if (apps >= 500) clues.push(`I've made ${apps}+ recorded appearances in the database.`);
  else if (apps >= 150) clues.push(`I've made ${apps} recorded appearances in the database.`);
  if (peak?.seasonLabel && peak.appearances >= 10) {
    clues.push(
      `In ${peak.seasonLabel} I logged ${peak.appearances} appearances` +
        (peak.goals > 0 ? ` and ${peak.goals} goal${peak.goals === 1 ? "" : "s"}` : "") +
        ` in ${peak.competitionId.replace(/^tm-/, "").replace(/-/g, " ")}.`,
    );
  }
  if (wc > 0) clues.push(`I've scored ${wc} FIFA World Cup goal${wc === 1 ? "" : "s"} in tracked tournaments.`);
  if (awards.some((a) => /ballon/i.test(a.award))) clues.push("I've been recognised with a Ballon d'Or in this archive.");
  else if (awards[0]) clues.push(`I've won a major individual award: ${awards[0]!.award}.`);
  if (clubs[2]) clues.push(`I've also turned out for ${clubs[2]}.`);
  if (clubs[3]) clues.push(`Later in my career I featured for ${clubs[3]}.`);

  if (player.clues?.length) {
    for (const c of player.clues) {
      if (isBoilerplateClue(c)) continue;
      if (!clues.includes(c)) clues.push(c);
    }
  }

  return unique(clues).filter(Boolean).slice(0, 8);
}

export function isQuizEligiblePlayer(player: Player, stats: PlayerSeasonStat[]): boolean {
  if (!player.name?.trim()) return false;
  return generatePlayerClues(player, stats).length >= 3;
}

let quizPlayerCache: Player[] | null = null;
let quizPlayerById: Map<string, Player> | null = null;

/** Full-database quiz pool — every eligible extended player with ≥3 real clues. */
export function getProceduralQuizPlayers(): Player[] {
  if (quizPlayerCache) return quizPlayerCache;
  const players = getExtendedPlayers()
    .filter((p) => p.sport === "football")
    .map((p) => {
      const stats = getSeasonStats(p.id);
      if (!isQuizEligiblePlayer(p, stats)) return null;
      const clues = generatePlayerClues(p, stats);
      const clubs = p.clubs?.length ? p.clubs : seniorClubsFromStats(stats);
      return { ...p, clues, clubs } satisfies Player;
    })
    .filter((p): p is Player => p != null);
  quizPlayerCache = players;
  quizPlayerById = new Map(players.map((p) => [p.id, p]));
  return players;
}

/** O(1) lookup of the quiz card (rich clues) — not the raw ETL row. */
export function getProceduralQuizPlayer(id: string): Player | undefined {
  if (!quizPlayerById) getProceduralQuizPlayers();
  return quizPlayerById?.get(id);
}

export function resetProceduralQuizCache(): void {
  quizPlayerCache = null;
  quizPlayerById = null;
}

function clubDisplayName(club: Club): string {
  return club.name || cleanClubName(club.id.replace(/-/g, " "));
}

function generateClubClues(club: Club): string[] {
  const clues: string[] = [];
  if (club.country) clues.push(`We are based in ${club.country}.`);
  if (club.league) {
    const comp = getCompetitions().find((c) => c.id === club.league);
    clues.push(`We compete in ${comp?.name ?? club.league.replace(/-/g, " ")}.`);
  }
  if (club.nickname) clues.push(`Our nickname is ${club.nickname}.`);
  if (club.stadium) clues.push(`Our home ground is ${club.stadium}.`);
  if (club.founded) clues.push(`The club was founded in ${club.founded}.`);
  if (club.clues?.length) clues.push(...club.clues);
  return unique(clues).filter(Boolean).slice(0, 6);
}

let quizClubCache: Club[] | null = null;

export function getProceduralQuizClubs(): Club[] {
  if (quizClubCache) return quizClubCache;
  quizClubCache = getClubsExtended()
    .map((c) => {
      const clues = c.clues?.length >= 3 ? c.clues : generateClubClues(c);
      return clues.length >= 3 ? { ...c, clues } : null;
    })
    .filter((c): c is Club => c != null);
  return quizClubCache;
}

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pickDistractors(correct: string, pool: string[], count: number, seed: string): string[] {
  const filtered = pool.filter((n) => n !== correct);
  const start = hashSeed(seed) % Math.max(1, filtered.length);
  const out: string[] = [];
  for (let i = 0; i < filtered.length && out.length < count; i++) {
    const name = filtered[(start + i) % filtered.length]!;
    if (!out.includes(name)) out.push(name);
  }
  return out;
}

let trueFalseCache: TrueFalseStatement[] | null = null;

/** Procedural true/false from stat comparisons + curated bank. */
export function getProceduralTrueFalse(): TrueFalseStatement[] {
  if (trueFalseCache) return trueFalseCache;
  const curated = getCuratedTrueFalse();
  const players = getProceduralQuizPlayers();
  const generated: TrueFalseStatement[] = [];

  for (let i = 0; i < Math.min(players.length - 1, 400); i++) {
    const a = players[i]!;
    const b = players[(i * 17 + 3) % players.length]!;
    const statsA = getSeasonStats(a.id);
    const statsB = getSeasonStats(b.id);
    const goalsA = totalGoals(statsA);
    const goalsB = totalGoals(statsB);
    if (goalsA === goalsB) continue;

    const aHigher = goalsA > goalsB;
    generated.push({
      id: `ptf-goals-${a.id}-${b.id}`,
      sport: "football",
      text: `${a.name} has more recorded goals in this archive than ${b.name}.`,
      answer: aHigher,
      explanation: `Archive totals: ${a.name} ${goalsA}, ${b.name} ${goalsB}.`,
    });
  }

  for (const p of players.slice(0, 300)) {
    const wc = wcGoals(getSeasonStats(p.id));
    if (wc <= 0) continue;
    generated.push({
      id: `ptf-wc-${p.id}`,
      sport: "football",
      text: `${p.name} has scored at least one FIFA World Cup goal in tracked data.`,
      answer: true,
      explanation: `${p.name} has ${wc} recorded World Cup goal${wc === 1 ? "" : "s"}.`,
    });
  }

  trueFalseCache = [...curated, ...generated];
  return trueFalseCache;
}

let speedCache: SpeedQuestion[] | null = null;

/** Procedural speed-round questions from player/club/competition facts. */
export function getProceduralSpeedQuestions(): SpeedQuestion[] {
  if (speedCache) return speedCache;
  const curated = getCuratedSpeedQuestions();
  const players = getProceduralQuizPlayers();
  const nations = unique(players.map((p) => primaryNation(p.nationality)).filter(Boolean) as string[]);
  const generated: SpeedQuestion[] = [];

  for (const p of players.slice(0, 500)) {
    const nation = primaryNation(p.nationality);
    if (!nation) continue;
    const distractors = pickDistractors(nation, nations, 3, p.id);
    const options = [nation, ...distractors].slice(0, 4);
    generated.push({
      id: `psq-nation-${p.id}`,
      sport: "football",
      prompt: `Which nation is ${p.name} associated with?`,
      options,
      answerIndex: 0,
    });
  }

  for (const p of players.slice(0, 400)) {
    const stats = getSeasonStats(p.id);
    const clubs = seniorClubsFromStats(stats);
    const main = clubs[0] ?? p.clubs?.[0];
    if (!main) continue;
    const pool = unique(getProceduralQuizClubs().map(clubDisplayName));
    const distractors = pickDistractors(main, pool, 3, `${p.id}-club`);
    generated.push({
      id: `psq-club-${p.id}`,
      sport: "football",
      prompt: `Which club did ${p.name} play for (among these)?`,
      options: [main, ...distractors].slice(0, 4),
      answerIndex: 0,
    });
  }

  speedCache = [...curated, ...generated];
  return speedCache;
}

let careerCache: CareerPathEntry[] | null = null;

/** Career paths from chronological club sequences in season stats. */
export function getProceduralCareerPaths(): CareerPathEntry[] {
  if (careerCache) return careerCache;
  const curated = getCuratedCareerPaths();
  const byId = new Map(curated.map((c) => [c.playerId, c]));
  const generated: CareerPathEntry[] = [];

  for (const p of getProceduralQuizPlayers()) {
    if (byId.has(p.id)) continue;
    const stats = getSeasonStats(p.id);
    const clubs = seniorClubsFromStats(stats);
    if (clubs.length < 3) continue;
    generated.push({ id: `cp-${p.id}`, playerId: p.id, clubs: clubs.slice(0, 6) });
  }

  careerCache = [...curated, ...generated];
  return careerCache;
}

export function proceduralQuizCounts() {
  return {
    players: getProceduralQuizPlayers().length,
    clubs: getProceduralQuizClubs().length,
    trueFalse: getProceduralTrueFalse().length,
    speedQuestions: getProceduralSpeedQuestions().length,
    careerPaths: getProceduralCareerPaths().length,
  };
}
