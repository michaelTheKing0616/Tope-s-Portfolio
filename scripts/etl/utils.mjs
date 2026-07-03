import { readFileSync, existsSync, createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(__dirname, "../..");
export const RAW_DIR = resolve(ROOT, "sportverse/data/raw");
export const OUT_DIR = resolve(ROOT, "sportverse/packages/sports-db/data");
export const CURATED_PLAYERS = resolve(OUT_DIR, "players.json");

/** Minimal RFC4180 CSV parser (handles quoted fields). */
export function parseCsv(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(Boolean);
  if (!lines.length) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? "";
    });
    return row;
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

export function readCsv(path) {
  if (!existsSync(path)) return [];
  return parseCsv(readFileSync(path, "utf8"));
}

export function slugify(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

export function normalizeName(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function mapPosition(code, flags = {}) {
  if (flags.goal_keeper === "1" || code === "GK") return "Goalkeeper";
  if (flags.forward === "1" || code === "FW") return "Forward";
  if (flags.midfielder === "1" || code === "MF") return "Midfielder";
  if (flags.defender === "1" || code === "DF") return "Defender";
  if (code === "DF") return "Defender";
  if (code === "MF") return "Midfielder";
  if (code === "FW") return "Forward";
  return "Midfielder";
}

export function loadCuratedPlayers() {
  return JSON.parse(readFileSync(CURATED_PLAYERS, "utf8"));
}

/** Stream-parse a CSV file row-by-row (memory-safe for multi-million row files). */
export async function streamCsv(path, onRow) {
  if (!existsSync(path)) return 0;
  let headers = null;
  let count = 0;
  const rl = createInterface({
    input: createReadStream(path, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
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
    count++;
  }
  return count;
}

export const ARCHIVE_DIR = resolve(ROOT, "sportverse/archive");
