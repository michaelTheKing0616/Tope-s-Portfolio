import type { DraftDifficulty, FormationSlot, Position, RatedPlayerCard } from "@sportverse/draftballer-types";
import { createRng } from "./rng.js";
import { draftPickAllowedForSlot } from "./squad-rules.js";

export interface BotDraftContext {
  openSlots: FormationSlot[];
  candidates: RatedPlayerCard[];
  pool: RatedPlayerCard[];
  pickedIds: Set<string>;
  difficulty: DraftDifficulty;
  seed: string;
}

function scarcityWeight(position: Position, pool: RatedPlayerCard[], picked: Set<string>): number {
  const remaining = pool.filter((p) => !picked.has(p.playerId) && p.position === position).length;
  if (position === "GK") return remaining <= 3 ? 1.5 : 1;
  if (position === "CB") return remaining <= 8 ? 1.2 : 1;
  return 1;
}

function valueOverReplacement(candidate: RatedPlayerCard, ctx: BotDraftContext): number {
  const pos = candidate.position;
  const peers = ctx.pool.filter((p) => !ctx.pickedIds.has(p.playerId) && p.position === pos);
  const bestLater = peers.length ? Math.max(...peers.map((p) => p.ovr)) : candidate.ovr;
  return candidate.ovr - bestLater * 0.85;
}

export function botPickPlayer(ctx: BotDraftContext): RatedPlayerCard | null {
  if (!ctx.candidates.length) return null;
  const rng = createRng(`${ctx.seed}:bot`);
  const slot = ctx.openSlots[0];
  const requiredPos = slot?.position;

  const eligible = requiredPos
    ? ctx.candidates.filter((c) => draftPickAllowedForSlot(c, requiredPos, true))
    : ctx.candidates;
  const pool = eligible.length ? eligible : ctx.candidates;

  const ranked = pool
    .map((c) => ({
      card: c,
      score:
        valueOverReplacement(c, ctx) * scarcityWeight(c.position, ctx.pool, ctx.pickedIds) +
        (c.fameScore ?? 0) * 0.02,
    }))
    .sort((a, b) => b.score - a.score);

  const diff = ctx.difficulty;
  if (diff === "easy") {
    const slice = ranked.slice(2, 6);
    return slice[Math.floor(rng.next() * slice.length)]?.card ?? ranked[2]?.card ?? ranked[0]?.card ?? null;
  }
  if (diff === "normal") {
    const slice = ranked.slice(0, 3);
    return slice[Math.floor(rng.next() * slice.length)]?.card ?? ranked[0]?.card ?? null;
  }
  return ranked[0]?.card ?? null;
}

export function botAutoPickFromPool(
  pool: RatedPlayerCard[],
  roster: string[],
  openPositions: Position[],
  difficulty: DraftDifficulty,
  seed: string,
): RatedPlayerCard | null {
  const pickedIds = new Set(roster);
  const remaining = pool.filter((p) => !pickedIds.has(p.playerId));
  const pos = openPositions[0];
  const candidates = pos
    ? remaining.filter((p) => draftPickAllowedForSlot(p, pos, true))
    : remaining;
  return botPickPlayer({
    openSlots: openPositions.map((position, i) => ({ id: `s${i}`, position })),
    candidates: candidates.length ? candidates : remaining,
    pool,
    pickedIds,
    difficulty,
    seed,
  });
}
