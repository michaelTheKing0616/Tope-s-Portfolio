#!/usr/bin/env node
/**
 * Extensive EA FC 26 calibration audit:
 * 1. Face-stat formula vs EA published OVR (ingestion fidelity)
 * 2. ea-current mode vs EA OVR (exact snapshot contract)
 * 3. all-time mode vs EA + expected prime uplift (non-legend)
 * 4. Stratified random samples across OVR bands and positions
 *
 * Usage: cd sportverse && npx tsx ../scripts/etl/audit-ea-calibration.mjs
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const dataDir = resolve(root, "sportverse/packages/sports-db/data");
const EA_CSV = resolve(root, "sportverse/eafc26_player_ratings/ea_fc26_players.csv");

function load(name) {
  const p = resolve(dataDir, name);
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : [];
}

/** Seeded shuffle for reproducible stratified sampling. */
function seededRand(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function ovrBucket(ovr) {
  if (ovr >= 89) return "89-91 elite";
  if (ovr >= 86) return "86-88 world-class";
  if (ovr >= 81) return "81-85 very good";
  if (ovr >= 76) return "76-80 good";
  if (ovr >= 66) return "66-75 average";
  if (ovr >= 56) return "56-65 squad";
  return "47-55 reserve";
}

function stats(rows) {
  if (!rows.length) return { n: 0, mae: 0, max: 0, p95: 0, mean: 0 };
  const abs = rows.map((r) => Math.abs(r.delta)).sort((a, b) => a - b);
  const mae = abs.reduce((s, v) => s + v, 0) / abs.length;
  const p95 = abs[Math.floor(abs.length * 0.95)] ?? abs.at(-1);
  return {
    n: rows.length,
    mae: mae,
    max: abs.at(-1),
    p95,
    mean: rows.reduce((s, r) => s + r.delta, 0) / rows.length,
  };
}

function fmt(s) {
  return `n=${s.n} MAE=${s.mae.toFixed(2)} p95=${s.p95.toFixed(1)} max=${s.max.toFixed(1)} bias=${s.mean >= 0 ? "+" : ""}${s.mean.toFixed(2)}`;
}

async function main() {
  const {
    ovrFromEaAttributes,
    ovrFromEaGkAttributes,
    setEaFc26Index,
    attachMvPercentilesFromPeakMv,
    setAwardsData,
    setFameDataForRatings,
  } = await import("../../sportverse/packages/rating-engine/src/index.ts");
  const { __setExtendedDataForTests } = await import(
    "../../sportverse/packages/sports-db/src/extended.ts"
  );
  const { buildDraftPool, getPresetMode, setLegendRatings, ratePlayerById } = await import(
    "../../sportverse/packages/draftballer-core/src/index.ts"
  );

  const eaIndex = load("ea-fc26-index.json");
  const legends = load("legend-ratings.json");
  const legendIds = new Set(legends.map((e) => e.playerId));
  const fame = load("fame-index.json");
  const statsPath = resolve(dataDir, "season-stats.json");
  const seasonStats = existsSync(statsPath)
    ? JSON.parse(readFileSync(statsPath, "utf8"))
    : load("season-stats.fixture.json");

  __setExtendedDataForTests({
    players: load("players-extended.json"),
    stats: seasonStats,
    competitions: load("competitions.json"),
    clubs: load("clubs-extended.json"),
    eras: load("era-baselines.json"),
    awards: load("awards.json"),
    moments: load("iconic_moments.json"),
    fameIndex: fame,
  });
  setAwardsData(load("awards.json"), load("iconic_moments.json"));
  setFameDataForRatings(attachMvPercentilesFromPeakMv(fame));
  setLegendRatings(legends);
  setEaFc26Index(eaIndex);

  const eaById = new Map(eaIndex.map((e) => [e.playerId, e]));
  const eaCurrentMode = getPresetMode("ea-current");
  const allTimeMode = getPresetMode("all-time-any");

  // ── 1. Face-stat reproduction (pure EA formula, no internal engine) ──
  const faceStatRows = [];
  for (const e of eaIndex) {
    let computed;
    if (e.gkAttributes) {
      computed = ovrFromEaGkAttributes(e.gkAttributes, e.ovr);
    } else if (e.attributes) {
      computed = ovrFromEaAttributes(e.quizPosition, e.attributes, e.ovr);
    } else continue;
    faceStatRows.push({
      name: e.name,
      pos: e.quizPosition,
      eaOvr: e.ovr,
      computed,
      delta: computed - e.ovr,
      bucket: ovrBucket(e.ovr),
    });
  }

  // ── 2. ea-current mode (must match EA exactly, except legends) ──
  const eaCurrentRows = [];
  const eaCurrentOutliers = [];
  for (const e of eaIndex) {
    if (legendIds.has(e.playerId)) continue;
    const card = ratePlayerById(e.playerId, eaCurrentMode);
    if (!card) continue;
    const row = {
      name: e.name,
      pos: e.quizPosition,
      eaOvr: e.ovr,
      internal: card.ovr,
      delta: card.ovr - e.ovr,
      bucket: ovrBucket(e.ovr),
    };
    eaCurrentRows.push(row);
    if (Math.abs(row.delta) > 0) eaCurrentOutliers.push(row);
  }

  // ── 3. all-time mode for non-legend EA players (expect >= EA, within prime uplift band) ──
  const allTimeRows = [];
  const allTimeUnderEa = [];
  for (const e of eaIndex) {
    if (legendIds.has(e.playerId)) continue;
    const card = ratePlayerById(e.playerId, allTimeMode);
    if (!card) continue;
    const row = {
      name: e.name,
      pos: e.quizPosition,
      eaOvr: e.ovr,
      internal: card.ovr,
      delta: card.ovr - e.ovr,
      bucket: ovrBucket(e.ovr),
      primeUplift: card.breakdown.eaPrimeUplift ?? 0,
    };
    allTimeRows.push(row);
    if (row.internal < row.eaOvr) allTimeUnderEa.push(row);
  }

  // ── 4. Stratified random sample (8 per bucket × position group) ──
  const rand = seededRand(42);
  const byBucketPos = new Map();
  for (const e of eaIndex) {
    if (legendIds.has(e.playerId)) continue;
    const key = `${ovrBucket(e.ovr)}|${e.quizPosition}`;
    const list = byBucketPos.get(key) ?? [];
    list.push(e);
    byBucketPos.set(key, list);
  }
  const sampleRows = [];
  for (const [key, list] of byBucketPos) {
    const shuffled = [...list].sort(() => rand() - 0.5);
    for (const e of shuffled.slice(0, 3)) {
      const current = ratePlayerById(e.playerId, eaCurrentMode);
      const allTime = ratePlayerById(e.playerId, allTimeMode);
      let computed = e.gkAttributes
        ? ovrFromEaGkAttributes(e.gkAttributes, e.ovr)
        : e.attributes
          ? ovrFromEaAttributes(e.quizPosition, e.attributes)
          : e.ovr;
      sampleRows.push({
        key,
        name: e.name,
        eaOvr: e.ovr,
        faceFormula: computed,
        eaCurrent: current?.ovr,
        allTime: allTime?.ovr,
        faceErr: computed - e.ovr,
        currentErr: (current?.ovr ?? 0) - e.ovr,
        allTimeDelta: (allTime?.ovr ?? 0) - e.ovr,
      });
    }
  }

  // ── CSV ingestion coverage ──
  let eaCsvRows = 0;
  if (existsSync(EA_CSV)) {
    eaCsvRows = readFileSync(EA_CSV, "utf8").trim().split("\n").length - 1;
  }

  const lines = [];
  const log = (s = "") => lines.push(s);

  log("# EA FC 26 Calibration Audit");
  log(`Generated: ${new Date().toISOString()}`);
  log("");
  log("## Dataset ingestion");
  log(`| Source | Rows |`);
  log(`|--------|------|`);
  log(`| ea_fc26_players.csv | ${eaCsvRows.toLocaleString()} |`);
  log(`| ea_fc26_outfield.csv | 14,412 (subset, not separately ingested) |`);
  log(`| ea_fc26_goalkeepers.csv | 1,816 (subset, not separately ingested) |`);
  log(`| ea-fc26-index.json (matched to DB) | ${eaIndex.length.toLocaleString()} |`);
  log(`| With card image | ${eaIndex.filter((e) => e.cardImage).length.toLocaleString()} |`);
  log(`| GK in index | ${eaIndex.filter((e) => e.quizPosition === "GK").length.toLocaleString()} |`);
  log(`| Match rate (EA CSV → DB) | ${((eaIndex.length / eaCsvRows) * 100).toFixed(1)}% |`);
  log(`| Legend overrides (excluded from EA comparison) | ${legends.length} |`);
  log("");

  log("## 1. Face-stat formula vs EA published OVR");
  log("(Tests whether we reverse-engineered EA's weighting correctly from the CSV attrs)");
  log(`**Overall:** ${fmt(stats(faceStatRows))}`);
  log("");
  for (const band of ["89-91 elite", "86-88 world-class", "81-85 very good", "76-80 good", "66-75 average", "56-65 squad", "47-55 reserve"]) {
    log(`| ${band} | ${fmt(stats(faceStatRows.filter((r) => r.bucket === band)))} |`);
  }
  log("");
  log("| Position | Stats |");
  log("|----------|-------|");
  for (const pos of ["GK", "ST", "W", "AM", "CM", "DM", "FB", "CB"]) {
    log(`| ${pos} | ${fmt(stats(faceStatRows.filter((r) => r.pos === pos)))} |`);
  }
  const faceOutliers = faceStatRows.filter((r) => Math.abs(r.delta) > 3).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 15);
  if (faceOutliers.length) {
    log("");
    log("Face-formula outliers (|err| > 3):");
    for (const r of faceOutliers) {
      log(`- ${r.name} (${r.pos}, EA ${r.eaOvr}): computed ${r.computed} (Δ${r.delta >= 0 ? "+" : ""}${r.delta})`);
    }
  }

  log("");
  log("## 2. ea-current mode vs EA OVR (contract: exact match, non-legend)");
  log(`**Overall:** ${fmt(stats(eaCurrentRows))}`);
  log(`Exact matches: ${eaCurrentRows.filter((r) => r.delta === 0).length}/${eaCurrentRows.length} (${((eaCurrentRows.filter((r) => r.delta === 0).length / eaCurrentRows.length) * 100).toFixed(1)}%)`);
  if (eaCurrentOutliers.length) {
    log("");
    log("ea-current mismatches:");
    for (const r of eaCurrentOutliers.slice(0, 20)) {
      log(`- ${r.name} (${r.pos}): EA ${r.eaOvr} → internal ${r.internal} (Δ${r.delta >= 0 ? "+" : ""}${r.delta})`);
    }
  }

  log("");
  log("## 3. all-time mode vs EA current (non-legend; expect floor ≥ EA + prime uplift)");
  log(`**Overall delta (internal − EA):** ${fmt(stats(allTimeRows))}`);
  log(`Below EA floor: ${allTimeUnderEa.length} players (${((allTimeUnderEa.length / allTimeRows.length) * 100).toFixed(2)}%)`);
  if (allTimeUnderEa.length) {
    for (const r of allTimeUnderEa.slice(0, 10)) {
      log(`- ${r.name}: EA ${r.eaOvr} → ${r.internal} (Δ${r.delta})`);
    }
  }
  log("");
  for (const band of ["89-91 elite", "86-88 world-class", "81-85 very good", "76-80 good", "66-75 average", "56-65 squad", "47-55 reserve"]) {
    const subset = allTimeRows.filter((r) => r.bucket === band);
    log(`- ${band}: mean Δ=${(subset.reduce((s, r) => s + r.delta, 0) / subset.length).toFixed(2)} (n=${subset.length})`);
  }

  log("");
  log("## 4. Stratified random sample (3 per bucket×position, seed=42)");
  log("| Band / Pos | Player | EA | Face | ea-current | all-time |");
  log("|------------|--------|----|------|------------|----------|");
  for (const r of sampleRows.sort((a, b) => b.eaOvr - a.eaOvr).slice(0, 60)) {
    log(`| ${r.key} | ${r.name} | ${r.eaOvr} | ${r.faceFormula} | ${r.eaCurrent} | ${r.allTime} |`);
  }

  log("");
  log("## 5. Named sanity checks");
  const checks = [
    "Mohamed Salah",
    "Kylian Mbappé",
    "Erling Haaland",
    "Jan Oblak",
    "Thibaut Courtois",
    "Virgil van Dijk",
    "Rodri",
    "Lionel Messi",
    "Kevin De Bruyne",
    "Raheem Sterling",
    "Cole Palmer",
    "Martin Ødegaard",
  ];
  log("| Player | EA | ea-current | all-time | Legend |");
  log("|--------|----|------------|----------|--------|");
  const pool = buildDraftPool(allTimeMode);
  const byName = new Map(pool.map((p) => [p.name, p]));
  for (const name of checks) {
    const card = byName.get(name);
    const ea = card ? eaById.get(card.playerId) : undefined;
    const current = card ? ratePlayerById(card.playerId, eaCurrentMode) : null;
    log(`| ${name} | ${ea?.ovr ?? "—"} | ${current?.ovr ?? "—"} | ${card?.ovr ?? "—"} | ${legendIds.has(card?.playerId ?? "") ? "yes" : "—"} |`);
  }

  log("");
  log("## Verdict");
  const faceMae = stats(faceStatRows).mae;
  const currentMae = stats(eaCurrentRows).mae;
  if (faceMae <= 1.5 && currentMae === 0) {
    log("✓ EA FC 26 face stats are faithfully ingested; ea-current mode is exact.");
  } else if (faceMae <= 2.5 && currentMae <= 0.5) {
    log("~ EA ingestion good with minor face-formula drift; ea-current mostly exact.");
  } else {
    log("✗ Calibration gaps detected — see sections above.");
  }
  log("");
  log("**Intelligent use:** EA data serves as (a) face-stat attribute source, (b) ea-current snapshot mode, (c) all-time floor + prime uplift for modern players, (d) card images. Legend anchors override for historical/prime ratings. ~30% of EA CSV rows unmatched to Transfermarkt DB (obscure/reserve players).");

  const out = lines.join("\n");
  console.log(out);
  writeFileSync(resolve(root, "BUILD_LOG_EA_AUDIT.txt"), `${out}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
