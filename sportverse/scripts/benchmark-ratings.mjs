/**
 * Rating Validation Suite §4.5 — measures sim prediction vs higher-rated side.
 * Run: node sportverse/scripts/benchmark-ratings.mjs
 */
import { buildDraftPool, getPresetMode } from "@sportverse/draftballer-core";
import { simulateMatchV2 } from "@sportverse/match-sim";

const TRIALS = 120;
const mode = getPresetMode("all-time-any");
const pool = buildDraftPool(mode).slice(0, 500);

function pickXi(offset = 0) {
  const slice = pool.slice(offset, offset + 11);
  if (slice.length < 11) return null;
  return {
    name: `XI ${offset}`,
    playerIds: slice.map((p) => p.playerId),
    players: slice,
    squadOvr: Math.round(slice.reduce((s, p) => s + p.ovr, 0) / slice.length),
  };
}

let higherRatedWins = 0;
let draws = 0;

for (let i = 0; i < TRIALS; i++) {
  const a = pickXi((i * 7) % 400);
  const b = pickXi((i * 11 + 13) % 400);
  if (!a || !b) continue;

  const stronger = a.squadOvr >= b.squadOvr ? a : b;
  const weaker = stronger === a ? b : a;
  const result = simulateMatchV2(stronger, weaker, `bench_${i}`, 1, {
    config: { simulationMode: "realistic" },
  });

  const strongGoals = result.homeGoals;
  const weakGoals = result.awayGoals;
  if (strongGoals > weakGoals) higherRatedWins++;
  else if (strongGoals === weakGoals) draws++;
}

const winRate = Math.round((higherRatedWins / TRIALS) * 1000) / 10;
console.log(
  JSON.stringify(
    {
      trials: TRIALS,
      higherRatedWinPct: winRate,
      draws,
      baselineRandom: 33.3,
      pass: winRate >= 52,
    },
    null,
    2,
  ),
);
