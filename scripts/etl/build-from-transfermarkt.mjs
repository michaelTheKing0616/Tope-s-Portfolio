import { createGunzip } from "node:zlib";
import { createReadStream, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { get as httpsGet } from "node:https";
import { resolve } from "node:path";
import { normalizeName, mapPosition, RAW_DIR } from "./utils.mjs";

const TM_BASE = "https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data";
const TM_RAW = resolve(RAW_DIR, "transfermarkt");

const TM_COMP_MAP = {
  GB1: "premier-league",
  ES1: "la-liga",
  IT1: "serie-a",
  L1: "bundesliga",
  FR1: "ligue-1",
};

function downloadGz(url, dest) {
  return new Promise((resolveDl, reject) => {
    mkdirSync(TM_RAW, { recursive: true });
    if (existsSync(dest)) {
      resolveDl(dest);
      return;
    }
    httpsGet(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Download failed ${url}: ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        writeFileSync(dest, Buffer.concat(chunks));
        resolveDl(dest);
      });
      res.on("error", reject);
    }).on("error", reject);
  });
}

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

async function streamCsvGz(path, onRow) {
  const gunzip = createGunzip();
  const input = createReadStream(path).pipe(gunzip);
  const rl = createInterface({ input, crlfDelay: Infinity });
  let headers = null;
  for await (const line of rl) {
    if (!line.trim()) continue;
    const cols = splitCsvLine(line);
    if (!headers) {
      headers = cols;
      continue;
    }
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? "";
    });
    await onRow(row);
  }
}

function mapTmCompetition(compId) {
  return TM_COMP_MAP[compId] ?? `tm-${String(compId).toLowerCase()}`;
}

function seasonFromDate(dateStr) {
  const year = Number((dateStr ?? "").slice(0, 4));
  if (!year || year < 1900) return "unknown";
  return String(year);
}

function decadeFromSeason(seasonLabel) {
  const y = Number(seasonLabel);
  if (!y) return "All-Time";
  if (y < 2000) return "1990s";
  if (y < 2010) return "2000s";
  if (y < 2020) return "2010s";
  return "2020s";
}

export async function buildFromTransfermarkt(existingNormIds, existingNormNames) {
  mkdirSync(TM_RAW, { recursive: true });

  const playersPath = await downloadGz(`${TM_BASE}/players.csv.gz`, resolve(TM_RAW, "players.csv.gz"));
  const appearancesPath = await downloadGz(
    `${TM_BASE}/appearances.csv.gz`,
    resolve(TM_RAW, "appearances.csv.gz"),
  );
  await downloadGz(`${TM_BASE}/clubs.csv.gz`, resolve(TM_RAW, "clubs.csv.gz"));
  await downloadGz(`${TM_BASE}/competitions.csv.gz`, resolve(TM_RAW, "competitions.csv.gz"));

  const tmPlayers = new Map();
  const clubsByPlayer = new Map();
  const clubNamesById = new Map();
  const statAgg = new Map();

  const clubsPath = resolve(TM_RAW, "clubs.csv.gz");
  await streamCsvGz(clubsPath, async (row) => {
    if (row.club_id) clubNamesById.set(row.club_id, row.name || row.club_name || "");
  });

  await streamCsvGz(playersPath, async (row) => {
    const tmId = row.player_id;
    if (!tmId) return;
    const name = row.name || `${row.first_name} ${row.last_name}`.trim();
    const norm = normalizeName(name);
    if (existingNormNames.has(norm)) return;

    const id = `tm-${tmId}`;
    if (existingNormIds.has(id)) return;

    const club = row.current_club_name?.trim();
    const clubs = club ? [club] : [];
    tmPlayers.set(tmId, {
      id,
      name,
      sport: "football",
      nationality: row.country_of_citizenship || row.country_of_birth || "",
      position: mapPosition(row.sub_position || row.position || ""),
      clubs,
      clues: [
        club ? `Club career includes ${club}.` : "Professional career on record.",
        row.last_season ? `Last active season ${row.last_season}.` : "Transfermarkt profile.",
      ],
      source: "transfermarkt",
      confidence: 0.92,
      tmId,
      lastSeason: Number(row.last_season) || undefined,
      marketValue: Number(row.market_value_in_eur) || 0,
    });
    clubsByPlayer.set(tmId, new Set(clubs));
  });

  let appearanceRows = 0;
  await streamCsvGz(appearancesPath, async (row) => {
    const tmId = row.player_id;
    if (!tmPlayers.has(tmId)) return;
    appearanceRows++;

    const clubSet = clubsByPlayer.get(tmId) ?? new Set();
    const clubName = clubNamesById.get(row.player_club_id);
    if (clubName) clubSet.add(clubName);
    clubsByPlayer.set(tmId, clubSet);

    const competitionId = mapTmCompetition(row.competition_id);
    const key = `${tmId}:${competitionId}`;
    const cur = statAgg.get(key) ?? {
      playerId: `tm-${tmId}`,
      seasonLabel: "career",
      competitionId,
      context: competitionId === "world-cup" ? "NATIONAL_TEAM" : "CLUB",
      appearances: 0,
      goals: 0,
      assists: 0,
      minutes: 0,
      confidence: 0.9,
    };
    cur.appearances += 1;
    cur.goals += Number(row.goals) || 0;
    cur.assists += Number(row.assists) || 0;
    cur.minutes += Number(row.minutes_played) || 0;
    statAgg.set(key, cur);
  });

  const playersExtended = [];
  const seasonStats = [];
  const decadesByPlayer = new Map();

  for (const stat of statAgg.values()) {
    if (stat.appearances < 1) continue;
    seasonStats.push(stat);
    const set = decadesByPlayer.get(stat.playerId) ?? new Set();
    set.add(decadeFromSeason(stat.seasonLabel));
    decadesByPlayer.set(stat.playerId, set);
  }

  for (const [, player] of tmPlayers) {
    const extraClubs = clubsByPlayer.get(player.tmId);
    if (extraClubs?.size) {
      player.clubs = [...new Set([...(player.clubs ?? []), ...extraClubs])].slice(0, 12);
    }
    player.decades = [...(decadesByPlayer.get(player.id) ?? new Set())];
    playersExtended.push(player);
    existingNormIds.add(player.id);
    existingNormNames.add(normalizeName(player.name));
  }

  return {
    playersExtended,
    seasonStats,
    meta: {
      transfermarktPlayers: playersExtended.length,
      appearanceRowsProcessed: appearanceRows,
      statRows: seasonStats.length,
    },
  };
}
