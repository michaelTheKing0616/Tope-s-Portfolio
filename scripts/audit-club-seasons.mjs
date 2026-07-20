#!/usr/bin/env node
/**
 * Audit 20 random spinnable club-seasons — Phase 4 data-quality pass.
 * Usage: node scripts/audit-club-seasons.mjs
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = resolve(root, "sportverse/packages/sports-db/data");
const require = createRequire(import.meta.url);

function load(name) {
  const p = resolve(dataDir, name);
  if (!existsSync(p)) return name.includes("fixture") ? [] : load(name.replace(".json", ".fixture.json"));
  return JSON.parse(readFileSync(p, "utf8"));
}

function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function looksLikeCompetitionId(name) {
  const s = String(name).trim().toLowerCase();
  if (/^tm-c[a-z0-9]+$/i.test(s)) return true;
  if (/^[a-z]{2,3}-\d+$/i.test(s)) return true;
  const leagueLike = new Set([
    "premier-league",
    "la-liga",
    "serie-a",
    "bundesliga",
    "ligue-1",
    "champions-league",
    "europa-league",
    "world-cup",
  ]);
  return leagueLike.has(s);
}

async function main() {
  // Use vitest-style dynamic import of rebuilt index via tsx if available; else approximate from JSON.
  const {
    rebuildClubSeasonIndex,
    listSpinnableClubSeasons,
    looksLikeCompetitionId: looks,
    setPrebuiltClubSeasons,
  } = await import("../sportverse/packages/sports-db/src/club-season-index.ts").catch(() => ({
    rebuildClubSeasonIndex: null,
    setPrebuiltClubSeasons: null,
  }));

  const players = load("players-extended.json");
  const statsPath = resolve(dataDir, "season-stats.json");
  const stats = existsSync(statsPath)
    ? JSON.parse(readFileSync(statsPath, "utf8"))
    : load("season-stats.fixture.json");
  const clubs = load("clubs-extended.json");
  const fame = load("fame-index.json");
  const fameMap = new Map(fame.map((e) => [e.playerId, e.fameScore]));

  // Inject fame into sports-db module path if available
  try {
    const fameMod = await import("../sportverse/packages/sports-db/src/fame.ts");
    fameMod.setFameIndex(fame);
  } catch {
    /* ok */
  }

  const statsByPlayer = new Map();
  for (const s of stats) {
    const list = statsByPlayer.get(s.playerId) ?? [];
    list.push(s);
    statsByPlayer.set(s.playerId, list);
  }
  const playerClubsById = new Map(players.map((p) => [p.id, p.clubs ?? []]));
  const nameById = new Map(players.map((p) => [p.id, p.name]));

  const rosters = load("club-season-rosters.json");
  if (setPrebuiltClubSeasons && Array.isArray(rosters) && rosters.length) {
    setPrebuiltClubSeasons(rosters);
  }
  if (rebuildClubSeasonIndex) {
    rebuildClubSeasonIndex(statsByPlayer, clubs, playerClubsById);
  }

  const mode = {
    id: "all-time-any",
    title: "All-Time",
    blurb: "",
    era: "all_time",
    competitionScope: "any_league",
    ratingLens: "club_only",
    blendFactor: 0,
  };

  let spinnable = [];
  if (listSpinnableClubSeasons) {
    spinnable = listSpinnableClubSeasons(mode);
  }

  const rng = mulberry32(20260720);
  const sample = [];
  const pool = [...spinnable];
  for (let i = 0; i < 20 && pool.length; i++) {
    const idx = Math.floor(rng() * pool.length);
    sample.push(pool.splice(idx, 1)[0]);
  }

  const lines = [];
  lines.push(`# Club-season audit — ${new Date().toISOString().slice(0, 10)}`);
  lines.push(`Spinnable club-seasons: ${spinnable.length}`);
  lines.push("");
  let leaked = 0;
  for (const entry of sample) {
    const bad = looksLikeCompetitionId(entry.clubName) || (looks && looks(entry.clubName));
    if (bad) leaked++;
    const top = [...entry.playerIds]
      .sort((a, b) => (fameMap.get(b) ?? 0) - (fameMap.get(a) ?? 0))
      .slice(0, 8)
      .map((id) => `${nameById.get(id) ?? id} (${fameMap.get(id) ?? 0})`)
      .join(", ");
    const hasGk = entry.playerIds.some((id) => {
      const p = players.find((x) => x.id === id);
      return /gk|goal/i.test(p?.position ?? "");
    });
    lines.push(
      `${bad ? "⚠️ " : "✓ "}${entry.clubName} · ${entry.seasonLabel} · n=${entry.playerIds.length} · fameSum=${entry.fameSum} · GK? ${hasGk}`,
    );
    lines.push(`  top: ${top}`);
  }
  lines.push("");
  lines.push(`Competition-id leaks in sample: ${leaked}/20`);
  const out = lines.join("\n");
  console.log(out);
  writeFileSync(resolve(root, "BUILD_LOG_CLUB_SEASON_AUDIT.txt"), out + "\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
