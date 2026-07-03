import type { MatchEvent, MatchResult, SimSquadInput } from "@sportverse/draftballer-types";
import { createRng, type Rng } from "./rng.js";
import { squadStrengths } from "./squad.js";
import { commentaryFor } from "./commentary.js";

const PHASES = 85;

function pickScorer(squad: SimSquadInput, rng: Rng): string {
  const attackers = squad.players.filter((p) => ["ST", "W", "AM", "CM"].includes(p.position));
  const pool = attackers.length ? attackers : squad.players;
  const weights = pool.map((p) => p.attributes.sho + p.ovr * 0.3);
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) return pool[i]!.name;
  }
  return pool[0]!.name;
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/** Original §7.1 engine — Prime Powers / legacy path. */
export function simulateMatchLegacy(
  home: SimSquadInput,
  away: SimSquadInput,
  seed: string,
  matchday: number,
): MatchResult {
  const rng = createRng(`${seed}:md${matchday}`);
  const homeStr = squadStrengths(home.players);
  const awayStr = squadStrengths(away.players);

  let homeGoals = 0;
  let awayGoals = 0;
  const events: MatchEvent[] = [];
  events.push({ minute: 0, type: "kickoff", team: "home", text: commentaryFor("kickoff") });

  for (let phase = 0; phase < PHASES; phase++) {
    const minute = Math.min(90, Math.floor((phase / PHASES) * 90) + 1);
    const homePossession = rng() < sigmoid((homeStr.midfield - awayStr.midfield) / 12);
    const atk = homePossession ? homeStr : awayStr;
    const def = homePossession ? awayStr : homeStr;
    const atkSquad = homePossession ? home : away;
    const team = homePossession ? "home" : "away";

    const chanceProb = sigmoid((atk.attack + atk.midfield * 0.4 - def.defense - def.gk * 0.3) / 14);
    if (rng() > chanceProb * 0.82) continue;

    const shotProb = sigmoid((atk.attack - def.gk) / 10);
    if (rng() > shotProb * 0.62) {
      const scorer = pickScorer(atkSquad, rng);
      events.push({
        minute,
        type: "chance_missed",
        team,
        playerName: scorer,
        text: commentaryFor("chance_missed", scorer, minute),
      });
      continue;
    }

    const goalProb = sigmoid((atk.attack * 0.6 + atk.midfield * 0.2 - def.gk) / 11);
    const scorer = pickScorer(atkSquad, rng);

    if (rng() < goalProb * 0.52) {
      if (homePossession) homeGoals++;
      else awayGoals++;
      events.push({
        minute,
        type: "goal",
        team,
        playerName: scorer,
        text: commentaryFor("goal", scorer, minute),
      });
    } else {
      events.push({
        minute,
        type: "shot_saved",
        team,
        playerName: scorer,
        text: commentaryFor("shot_saved", scorer, minute),
      });
    }
  }

  events.push({ minute: 90, type: "fulltime", team: "home", text: commentaryFor("fulltime") });

  return {
    homeGoals,
    awayGoals,
    homeName: home.name ?? "Your XI",
    awayName: away.name ?? "Opponent",
    events,
    mvpPlayerId: pickMvp(home, away, homeGoals, awayGoals, rng),
  };
}

function pickMvp(
  home: SimSquadInput,
  away: SimSquadInput,
  hg: number,
  ag: number,
  rng: Rng,
): string | undefined {
  const wonHome = hg > ag;
  const squad = wonHome || hg === ag ? home : away;
  if (!squad.players.length) return undefined;
  const sorted = [...squad.players].sort((a, b) => b.ovr - a.ovr);
  const top = sorted.slice(0, 3);
  return top[Math.floor(rng() * top.length)]?.playerId;
}
