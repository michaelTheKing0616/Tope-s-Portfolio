import type { RatedPlayerCard } from "@sportverse/draftballer-types";
import type { PlayerSimState } from "@sportverse/draftballer-types";

/** Bot rotation logic for tournament/season fatigue management (§9). */
export function selectRotationSubs(
  squad: RatedPlayerCard[],
  fatigue: Map<string, PlayerSimState>,
  bench: RatedPlayerCard[],
  maxChanges = 3,
): { out: string[]; in: string[] } {
  const out: string[] = [];
  const inIds: string[] = [];

  const fatigued = squad
    .map((p) => ({
      p,
      state: fatigue.get(p.playerId),
      score: (fatigue.get(p.playerId)?.fatigueMultiplier ?? 1) + (fatigue.get(p.playerId)?.carryFatigue ?? 0) * 0.05,
    }))
    .filter((x) => x.state && (x.state.fatigueMultiplier < 0.9 || x.state.carryFatigue > 1))
    .sort((a, b) => a.score - b.score);

  for (const { p } of fatigued.slice(0, maxChanges)) {
    const replacement = bench.find(
      (b) => b.position === p.position && !inIds.includes(b.playerId) && !out.includes(b.playerId),
    ) ?? bench.find((b) => !inIds.includes(b.playerId));
    if (replacement) {
      out.push(p.playerId);
      inIds.push(replacement.playerId);
    }
  }

  return { out, in: inIds };
}

export function applyRotationToSquad(
  starters: RatedPlayerCard[],
  bench: RatedPlayerCard[],
  rotation: { out: string[]; in: string[] },
): RatedPlayerCard[] {
  const next = [...starters];
  for (let i = 0; i < rotation.out.length; i++) {
    const outId = rotation.out[i]!;
    const inId = rotation.in[i];
    const idx = next.findIndex((p) => p.playerId === outId);
    const repl = bench.find((b) => b.playerId === inId);
    if (idx >= 0 && repl) next[idx] = repl;
  }
  return next;
}
