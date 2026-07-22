/**
 * Set-piece narrative sequences — Layer 2.
 * May convert only when a Dixon–Coles goal slot is still available.
 */

import type { ExtendedMatchEvent, RatedPlayerCard } from "@sportverse/draftballer-types";
import type { Rng } from "./rng.js";
import type { PlayerMatchPersona } from "./player-traits.js";
import { traitXgBias } from "./player-traits.js";

export type SetPieceKind = "corner" | "free_kick";

export interface SetPieceOutcome {
  events: ExtendedMatchEvent[];
  scored: boolean;
  xg: number;
  scorer?: RatedPlayerCard;
}

function pickTaker(players: RatedPlayerCard[], personas: Map<string, PlayerMatchPersona>, rng: Rng): RatedPlayerCard {
  const outfield = players.filter((p) => p.position !== "GK");
  const pool = outfield.length ? outfield : players;
  const weights = pool.map((p) => {
    const persona = personas.get(p.playerId);
    let w = p.attributes.pas * 1.2 + p.ovr * 0.2;
    if (persona?.traits.includes("set_piece")) w *= 1.45;
    if (persona?.traits.includes("creator")) w *= 1.15;
    return w;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) return pool[i]!;
  }
  return pool[0]!;
}

function pickAerialTarget(players: RatedPlayerCard[], personas: Map<string, PlayerMatchPersona>, rng: Rng): RatedPlayerCard {
  const box = players.filter((p) => ["ST", "CB", "CM", "AM", "W"].includes(p.position));
  const pool = box.length ? box : players.filter((p) => p.position !== "GK");
  const weights = pool.map((p) => {
    const persona = personas.get(p.playerId);
    let w = p.attributes.phy * 1.1 + p.attributes.sho * 0.5 + p.ovr * 0.15;
    if (persona?.traits.includes("aerial") || persona?.traits.includes("target_man")) w *= 1.4;
    if (persona?.traits.includes("clinical")) w *= 1.15;
    return w;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) return pool[i]!;
  }
  return pool[0]!;
}

export function shouldTriggerSetPiece(opts: {
  minute: number;
  chase: number;
  setPieceThreat: number;
  dueSoon: boolean;
  rng: Rng;
}): boolean {
  // Occasional flavor — more when chasing or with set-piece specialists.
  const base = 0.045 + opts.setPieceThreat * 0.04 + Math.max(0, opts.chase) * 0.08;
  if (opts.dueSoon && opts.rng() < 0.22) return true;
  return opts.rng() < base;
}

export function resolveSetPiece(opts: {
  kind: SetPieceKind;
  minute: number;
  team: "home" | "away";
  attackers: RatedPlayerCard[];
  personas: Map<string, PlayerMatchPersona>;
  canScore: boolean;
  dueSoon: boolean;
  rng: Rng;
  goalText: (scorer: RatedPlayerCard, minute: number, xg: number) => string;
}): SetPieceOutcome {
  const taker = pickTaker(opts.attackers, opts.personas, opts.rng);
  const target = pickAerialTarget(opts.attackers, opts.personas, opts.rng);
  const targetPersona = opts.personas.get(target.playerId);
  const takerPersona = opts.personas.get(taker.playerId);

  const baseXg =
    opts.kind === "free_kick"
      ? 0.08 + (taker.attributes.pas + taker.attributes.sho) / 400
      : 0.1 + target.attributes.phy / 500 + target.attributes.sho / 600;
  const xg = Math.max(
    0.05,
    Math.min(
      0.55,
      baseXg +
        traitXgBias(takerPersona, "set_piece") +
        traitXgBias(targetPersona, "set_piece") +
        (opts.rng() - 0.5) * 0.06,
    ),
  );

  const events: ExtendedMatchEvent[] = [];
  const kindLabel = opts.kind === "corner" ? "Corner" : "Free-kick";
  events.push({
    minute: opts.minute,
    type: opts.kind,
    team: opts.team,
    playerName: taker.name,
    xg,
    text:
      opts.kind === "corner"
        ? `${opts.minute}' ${kindLabel} — ${taker.name} whips it in…`
        : `${opts.minute}' ${kindLabel} — ${taker.name} stands over it…`,
  });

  // Delivery quality
  if (opts.rng() > 0.72 + (takerPersona?.traits.includes("set_piece") ? 0.12 : 0)) {
    events.push({
      minute: opts.minute,
      type: "chance_missed",
      team: opts.team,
      playerName: taker.name,
      xg,
      text: `${opts.minute}' Poor delivery from ${taker.name} — chance gone.`,
    });
    return { events, scored: false, xg };
  }

  events.push({
    minute: opts.minute,
    type: "set_piece_chance",
    team: opts.team,
    playerName: target.name,
    xg,
    text: `${opts.minute}' ${target.name} meets it — ${xg >= 0.28 ? "dangerous" : "half-chance"}!`,
  });

  const convertP = opts.dueSoon
    ? Math.min(0.95, 0.65 + xg * 0.4)
    : opts.canScore
      ? xg * 0.35
      : 0;

  if (opts.canScore && opts.rng() < convertP) {
    events.push({
      minute: opts.minute,
      type: "goal",
      team: opts.team,
      playerName: target.name,
      xg,
      text: opts.goalText(target, opts.minute, xg),
    });
    return { events, scored: true, xg, scorer: target };
  }

  if (xg >= 0.28) {
    events.push({
      minute: opts.minute,
      type: "big_chance",
      team: opts.team,
      playerName: target.name,
      xg,
      text: `${opts.minute}' How did ${target.name} miss that from the set piece?!`,
    });
  } else {
    events.push({
      minute: opts.minute,
      type: "shot_saved",
      team: opts.team,
      playerName: target.name,
      xg,
      text: `${opts.minute}' Keeper claims it — ${target.name} denied from the dead ball.`,
    });
  }
  return { events, scored: false, xg };
}

export function pickSetPieceKind(rng: Rng): SetPieceKind {
  return rng() < 0.62 ? "corner" : "free_kick";
}
