#!/usr/bin/env node
/**
 * Build ea-fc26-index.json — crosswalk EA FC 26 ratings → Sportverse player ids.
 *
 * Sources:
 *   sportverse/eafc26_player_ratings/ea_fc26_players.csv  (16k ratings + face stats)
 *   sportverse/cards/*.webp                               (17k card images, filename = display name)
 *   sportverse/packages/sports-db/data/players-extended.json
 *
 * Output: sportverse/packages/sports-db/data/ea-fc26-index.json
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeName, parseCsv, OUT_DIR } from "./utils.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const EA_CSV = resolve(ROOT, "sportverse/eafc26_player_ratings/ea_fc26_players.csv");
const CARDS_DIR = resolve(ROOT, "sportverse/cards");
const PLAYERS_JSON = resolve(OUT_DIR, "players-extended.json");
const FAME_JSON = resolve(OUT_DIR, "fame-index.json");
const OUT_JSON = resolve(OUT_DIR, "ea-fc26-index.json");

/** Hard overrides when name matching lands on archive stubs or wrong homonyms. */
const EA_PLAYER_ID_OVERRIDES = new Map([
  ["rodri", "rodri"],
]);

function isStubId(id) {
  return (id ?? "").startsWith("not-applicable-");
}

/** Map EA position codes → Sportverse quiz position. */
export function mapEaToQuizPosition(eaPos) {
  const p = (eaPos ?? "").toUpperCase();
  if (p === "GK") return "GK";
  if (p === "CB" || p === "LCB" || p === "RCB") return "CB";
  if (p === "LB" || p === "RB" || p === "LWB" || p === "RWB") return "FB";
  if (p === "CDM" || p === "LDM" || p === "RDM") return "DM";
  if (p === "CM" || p === "LCM" || p === "RCM") return "CM";
  if (p === "CAM" || p === "LAM" || p === "RAM") return "AM";
  if (p === "LW" || p === "RW" || p === "LM" || p === "RM") return "W";
  if (p === "ST" || p === "CF" || p === "LS" || p === "RS") return "ST";
  return "CM";
}

function displayName(row) {
  const common = (row.commonName ?? "").trim();
  if (common) return common;
  return `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim();
}

function int(row, key) {
  const n = Number(row[key]);
  return Number.isFinite(n) ? n : 0;
}

function idRankScore(id, fameScore, clubs) {
  let score = fameScore;
  if (isStubId(id)) score -= 10_000;
  if (id.startsWith("tm-")) score += 100;
  if (!id.includes("-")) score += 50;
  score += Math.min(clubs, 20);
  return score;
}

function resolveDbId(name, nationality, byNorm, fame, byTmId, eaRowId) {
  const override = EA_PLAYER_ID_OVERRIDES.get(normalizeName(name));
  if (override) return override;

  const tmHit = byTmId?.get(String(eaRowId ?? ""));
  if (tmHit && !isStubId(tmHit)) return tmHit;

  let candidates = byNorm.get(normalizeName(name)) ?? [];
  if (!candidates.length) return null;

  const real = candidates.filter((p) => !isStubId(p.id));
  if (real.length) candidates = real;

  if (nationality) {
    const nat = nationality.toLowerCase();
    const natMatch = candidates.filter((p) =>
      (p.nationality ?? "").toLowerCase().includes(nat),
    );
    if (natMatch.length === 1) return natMatch[0].id;
    if (natMatch.length > 1) candidates = natMatch;
  }

  if (candidates.length === 1) return candidates[0].id;

  const ranked = candidates
    .map((p) => ({
      p,
      score: idRankScore(p.id, fame.get(p.id) ?? 0, p.clubs?.length ?? 0),
    }))
    .sort((a, b) => b.score - a.score);
  if ((ranked[0]?.score ?? -10_000) <= -5000) return null;
  return ranked[0].p.id;
}

function main() {
  if (!existsSync(EA_CSV)) {
    console.error("Missing EA CSV:", EA_CSV);
    process.exit(1);
  }

  const players = JSON.parse(readFileSync(PLAYERS_JSON, "utf8"));
  const fame = new Map(
    existsSync(FAME_JSON)
      ? JSON.parse(readFileSync(FAME_JSON, "utf8")).map((e) => [e.playerId, e.fameScore ?? 0])
      : [],
  );

  const byNorm = new Map();
  const byTmId = new Map();
  for (const p of players) {
    const norm = normalizeName(p.name ?? "");
    if (norm) {
      const list = byNorm.get(norm) ?? [];
      list.push(p);
      byNorm.set(norm, list);
    }
    if (p.tmId) byTmId.set(String(p.tmId), p.id);
  }

  const cardByNorm = new Map();
  if (existsSync(CARDS_DIR)) {
    for (const file of readdirSync(CARDS_DIR)) {
      if (!file.endsWith(".webp")) continue;
      const norm = normalizeName(file.replace(/\.webp$/i, ""));
      if (norm) cardByNorm.set(norm, `cards/${file}`);
    }
  }

  const eaRows = parseCsv(readFileSync(EA_CSV, "utf8"));
  const index = [];
  const warnings = [];
  let matched = 0;

  for (const row of eaRows) {
    const name = displayName(row);
    const norm = normalizeName(name);
    const nationality = row.nationality ?? "";
    const playerId = resolveDbId(name, nationality, byNorm, fame, byTmId, row.id);
    if (!playerId) {
      warnings.push(`UNMATCHED EA: ${name} (${nationality}, ${row.team})`);
      continue;
    }

    const isGk = (row.position ?? "").toUpperCase() === "GK";
    const entry = {
      playerId,
      eaId: row.id,
      name,
      ovr: int(row, "overallRating"),
      eaPosition: row.position ?? "",
      quizPosition: mapEaToQuizPosition(row.position),
      nationality,
      team: row.team ?? "",
      league: row.leagueName ?? "",
      attributes: isGk
        ? undefined
        : {
            pac: int(row, "pac"),
            sho: int(row, "sho"),
            pas: int(row, "pas"),
            dri: int(row, "dri"),
            def: int(row, "def"),
            phy: int(row, "phy"),
          },
      gkAttributes: isGk
        ? {
            diving: int(row, "gkDiving"),
            handling: int(row, "gkHandling"),
            kicking: int(row, "gkKicking"),
            positioning: int(row, "gkPositioning"),
            reflexes: int(row, "gkReflexes"),
          }
        : undefined,
      cardImage: cardByNorm.get(norm),
    };
    index.push(entry);
    matched++;
  }

  const byPlayer = new Map();
  for (const e of index) {
    const prev = byPlayer.get(e.playerId);
    if (!prev || e.ovr > prev.ovr) byPlayer.set(e.playerId, e);
  }
  const deduped = [...byPlayer.values()].sort((a, b) => b.ovr - a.ovr || a.name.localeCompare(b.name));

  writeFileSync(OUT_JSON, JSON.stringify(deduped, null, 1));

  console.log(`✓ ea-fc26-index.json: ${deduped.length} players (${matched} raw matches, ${warnings.length} EA-only)`);
  console.log(`  with card image: ${deduped.filter((e) => e.cardImage).length}/${deduped.length}`);
  if (warnings.length <= 20) {
    for (const w of warnings.slice(0, 20)) console.log(`  - ${w}`);
  } else {
    console.log(`  (${warnings.length} unmatched EA rows — mostly obscure/reserve players)`);
  }
}

const isMain = process.argv[1]?.endsWith("build-ea-fc26-index.mjs");
if (isMain) main();
