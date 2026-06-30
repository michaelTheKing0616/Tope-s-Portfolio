import type { CareerPathEntry, Club, Player, SpeedQuestion, TrueFalseStatement } from "./db-types.js";
import type { DecisionId, FootballIQScenario, GoalkeeperLevel, StrikerCues } from "./game-types.js";
import {
  CLUB_NAMES,
  FIRST_NAMES,
  FIQ_TEMPLATES,
  LAST_NAMES,
  LEAGUES,
  NATIONS,
  NICKNAMES,
  OPTION_LABELS,
  POSITIONS,
  SPEED_TEMPLATES,
  STADIUMS,
  TF_TEMPLATES,
  TROPHIES,
} from "./seeds.js";
import { mulberry32, pick, pickN } from "./rng.js";

export const POOL_SIZE = 1000;

export function generatePlayers(count = POOL_SIZE): Player[] {
  const out: Player[] = [];
  for (let i = 0; i < count; i++) {
    const rng = mulberry32(i * 7919 + 1);
    const first = pick(rng, FIRST_NAMES);
    const last = pick(rng, LAST_NAMES);
    const name = `${first} ${last}`;
    const nation = pick(rng, NATIONS);
    const position = pick(rng, POSITIONS);
    const clubs = pickN(rng, CLUB_NAMES, 3 + Math.floor(rng() * 3));
    const trophy = pick(rng, TROPHIES);
    const debutAge = 16 + Math.floor(rng() * 4);
    const number = 1 + Math.floor(rng() * 30);

    out.push({
      id: `player-${i}`,
      name,
      sport: "football",
      nationality: nation,
      position,
      clubs,
      clues: [
        `I debuted professionally before turning ${debutAge + 2}.`,
        `I am from ${nation}.`,
        `I primarily play as a ${position.toLowerCase()}.`,
        `I have won the ${trophy}.`,
        `I wear number ${number}.`,
        `I have played for ${clubs[clubs.length - 1]}.`,
      ],
    });
  }
  return out;
}

export function generateClubs(count = POOL_SIZE): Club[] {
  const out: Club[] = [];
  for (let i = 0; i < count; i++) {
    const rng = mulberry32(i * 6271 + 2);
    const baseName = pick(rng, CLUB_NAMES);
    const suffix = i > 80 ? ` ${1900 + Math.floor(rng() * 120)}` : "";
    const name = i < CLUB_NAMES.length ? CLUB_NAMES[i % CLUB_NAMES.length]! : `${baseName}${suffix}`;
    const founded = 1870 + Math.floor(rng() * 130);
    const league = pick(rng, LEAGUES);
    const nickname = pick(rng, NICKNAMES);
    const stadium = pick(rng, STADIUMS);

    out.push({
      id: `club-${i}`,
      name,
      founded,
      league,
      nickname,
      stadium,
      country: pick(rng, NATIONS),
      clues: [
        `Founded: ${founded}`,
        `League: ${league}`,
        `Nickname: ${nickname}`,
        `Home: ${stadium}`,
        `Known as ${name}`,
      ],
    });
  }
  return out;
}

export function generateTrueFalse(count = POOL_SIZE): TrueFalseStatement[] {
  const out: TrueFalseStatement[] = [];
  for (let i = 0; i < count; i++) {
    const rng = mulberry32(i * 4177 + 3);
    const base = pick(rng, TF_TEMPLATES);
    const player = `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`;
    const year = 1990 + Math.floor(rng() * 35);
    const text = base.text.replace("player", player).replace("{year}", String(year));
    out.push({
      id: `tf-${i}`,
      text: i % 3 === 0 ? text : base.text,
      answer: i % 7 === 0 ? !base.answer : base.answer,
      explanation: base.explain,
      sport: pick(rng, ["football", "basketball", "cricket", "tennis"]),
    });
  }
  return out;
}

export function generateSpeedQuestions(count = POOL_SIZE): SpeedQuestion[] {
  const out: SpeedQuestion[] = [];
  for (let i = 0; i < count; i++) {
    const rng = mulberry32(i * 9311 + 4);
    const base = pick(rng, SPEED_TEMPLATES);
    const club = pick(rng, CLUB_NAMES);
    const prompt =
      i % 4 === 0
        ? base.prompt
        : `Which club is ${club}?` + ` (${["A", "B", "C"][i % 3]})`;
    const options =
      i % 4 === 0
        ? base.options
        : [club, pick(rng, CLUB_NAMES), pick(rng, CLUB_NAMES), pick(rng, CLUB_NAMES)].sort(() => rng() - 0.5);
    const answerIndex = i % 4 === 0 ? base.answerIndex : options.indexOf(club);
    out.push({
      id: `sq-${i}`,
      prompt,
      options,
      answerIndex: Math.max(0, answerIndex),
      sport: "football",
    });
  }
  return out;
}

export function generateCareerPaths(players: Player[]): CareerPathEntry[] {
  return players.map((p, i) => ({
    id: `cp-${i}`,
    playerId: p.id,
    clubs: p.clubs?.length ? [...p.clubs] : pickN(mulberry32(i), CLUB_NAMES, 4),
  }));
}

export function generateFootballIQScenario(index: number): FootballIQScenario {
  const rng = mulberry32(index * 3571 + 5);
  const tpl = pick(rng, FIQ_TEMPLATES);
  const minute = 1 + Math.floor(rng() * 90);
  const difficulties = ["beginner", "professional", "elite", "legend"] as const;
  const difficulty = difficulties[Math.min(3, Math.floor(index / 250))]!;
  const n = 1 + Math.floor(rng() * 4);
  const best = tpl.best;
  const ids: DecisionId[] = ["shoot", "pass_left", "through_ball", "cut_inside", "cross"];

  const options = ids.map((id) => {
    const isBest = id === best;
    const successRate = isBest ? 0.45 + rng() * 0.35 : 0.08 + rng() * 0.35;
    return {
      id,
      label: OPTION_LABELS[id] ?? id,
      successRate,
      outcome: isBest ? "Strong chance created!" : "Chance wasted.",
      explanation: isBest ? "Highest xG option in this shape." : "Lower probability choice for this pattern.",
      xpBonus: isBest ? 30 : 5,
    };
  });

  return {
    id: `fiq-${index}`,
    title: `${tpl.title} #${index + 1}`,
    minute,
    difficulty,
    context: tpl.ctx.replace("{n}", String(n)),
    timeLimitSec: difficulty === "legend" ? 3 : 4,
    options,
    bestChoice: best,
  };
}

export function generateFootballIQPool(count = POOL_SIZE): FootballIQScenario[] {
  return Array.from({ length: count }, (_, i) => generateFootballIQScenario(i));
}

export function generateGoalkeeperLevel(levelId: number): GoalkeeperLevel {
  const rng = mulberry32(levelId * 2749 + 6);
  const footAngle = pick(rng, ["left", "right", "center"] as const);
  const eyesLook = pick(rng, ["left", "center", "right"] as const);
  const shoulderOpen = rng() > 0.4;
  const runSpeed = pick(rng, ["slow", "medium", "fast"] as const);
  const fakes = levelId > 15 && rng() > 0.35;

  const cues: StrikerCues = { footAngle, shoulderOpen, eyesLook, runSpeed, fakes };

  // Actual shot: mostly foot angle; higher levels add deception
  let actual: "left" | "center" | "right" = footAngle === "center" ? "center" : footAngle;
  if (fakes && rng() > 0.55) {
    actual = eyesLook !== footAngle && eyesLook !== "center" ? eyesLook : actual;
  }

  const telegraphStrength = Math.max(0.1, 0.95 - levelId / 1200);

  return {
    id: levelId,
    title: `Penalty ${levelId}`,
    cues,
    actualShot: actual,
    telegraphStrength,
    description:
      levelId < 20
        ? "Read the plant foot."
        : levelId < 100
          ? "Eyes may lie — trust hips."
          : "Elite mind games.",
  };
}

export function generateGoalkeeperPool(count = POOL_SIZE): GoalkeeperLevel[] {
  return Array.from({ length: count }, (_, i) => generateGoalkeeperLevel(i + 1));
}

export type ContentPools = {
  players: Player[];
  clubs: Club[];
  trueFalse: TrueFalseStatement[];
  speedQuestions: SpeedQuestion[];
  careerPaths: CareerPathEntry[];
  footballIQ: FootballIQScenario[];
  goalkeeper: GoalkeeperLevel[];
};

let cached: ContentPools | null = null;

export function getContentPools(size = POOL_SIZE): ContentPools {
  if (cached && cached.players.length >= size) return cached;
  const players = generatePlayers(size);
  cached = {
    players,
    clubs: generateClubs(size),
    trueFalse: generateTrueFalse(size),
    speedQuestions: generateSpeedQuestions(size),
    careerPaths: generateCareerPaths(players),
    footballIQ: generateFootballIQPool(size),
    goalkeeper: generateGoalkeeperPool(size),
  };
  return cached;
}

export function poolSize(): number {
  return getContentPools().players.length;
}
