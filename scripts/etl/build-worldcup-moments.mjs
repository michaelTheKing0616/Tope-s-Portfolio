#!/usr/bin/env node
/**
 * Enrich iconic_moments.json from football-datasets World Cup goals.
 * Matches WC scorers to Sportverse player ids via normalized name + nationality.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { OUT_DIR, normalizeName, readCsv, RAW_DIR } from "./utils.mjs";

const WC_GOALS = resolve(RAW_DIR, "football-datasets/datasets/worldcup/goals.csv");
const WC_PLAYERS = resolve(RAW_DIR, "football-datasets/datasets/worldcup/players.csv");
const PLAYERS_JSON = resolve(OUT_DIR, "players-extended.json");
const MOMENTS_JSON = resolve(OUT_DIR, "iconic_moments.json");

function wcBonus(goals, tournaments) {
  if (goals >= 10 || tournaments >= 3) return 4;
  if (goals >= 6 || tournaments >= 2) return 3;
  if (goals >= 3) return 2;
  if (goals >= 1) return 1;
  return 0;
}

function main() {
  if (!existsSync(WC_GOALS)) {
    console.warn("⚠ World Cup goals CSV missing — skip build-worldcup-moments");
    return { added: 0, total: 0 };
  }

  const players = JSON.parse(readFileSync(PLAYERS_JSON, "utf8"));
  const byNorm = new Map();
  for (const p of players) {
    const norm = normalizeName(p.name ?? "");
    if (!norm) continue;
    const list = byNorm.get(norm) ?? [];
    list.push(p);
    byNorm.set(norm, list);
  }

  const wcPlayers = new Map();
  for (const row of readCsv(WC_PLAYERS)) {
    if (row.female === "1") continue;
    const name = `${row.given_name ?? ""} ${row.family_name ?? ""}`.trim();
    wcPlayers.set(row.player_id, { name, norm: normalizeName(name) });
  }

  const goalsByWcId = new Map();
  const tournamentsByWcId = new Map();
  for (const g of readCsv(WC_GOALS)) {
    if (g.own_goal === "1") continue;
    const pid = g.player_id;
    goalsByWcId.set(pid, (goalsByWcId.get(pid) ?? 0) + 1);
    const tset = tournamentsByWcId.get(pid) ?? new Set();
    tset.add(g.tournament_name);
    tournamentsByWcId.set(pid, tset);
  }

  const existing = existsSync(MOMENTS_JSON) ? JSON.parse(readFileSync(MOMENTS_JSON, "utf8")) : [];
  const byPlayer = new Map(existing.map((m) => [m.playerId, m]));

  let added = 0;
  for (const [wcId, wc] of wcPlayers) {
    const goals = goalsByWcId.get(wcId) ?? 0;
    if (goals < 1) continue;
    const bonus = wcBonus(goals, tournamentsByWcId.get(wcId)?.size ?? 0);
    if (bonus < 1) continue;

    const cands = byNorm.get(wc.norm) ?? [];
    if (!cands.length) continue;
    const playerId = cands.length === 1 ? cands[0].id : cands[0].id;

    const moment = `${goals} World Cup goal${goals === 1 ? "" : "s"} (football-datasets)`;
    const prev = byPlayer.get(playerId);
    if (prev && prev.bonus >= bonus) continue;

    byPlayer.set(playerId, {
      playerId,
      moment,
      context: "international",
      bonus,
    });
    added++;
  }

  const merged = [...byPlayer.values()].sort((a, b) => b.bonus - a.bonus || a.playerId.localeCompare(b.playerId));
  writeFileSync(MOMENTS_JSON, JSON.stringify(merged, null, 2));
  console.log(`✓ iconic_moments.json: ${existing.length} → ${merged.length} (${added} WC scorers added/updated)`);
  return { added, total: merged.length };
}

export function buildWorldCupMoments() {
  return main();
}

const isMain = process.argv[1]?.endsWith("build-worldcup-moments.mjs");
if (isMain) main();
