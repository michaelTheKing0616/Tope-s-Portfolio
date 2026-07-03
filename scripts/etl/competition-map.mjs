/** Map Transfermarkt competition_id → internal competitionId + metadata. */
const LEAGUE_MAP = {
  GB1: { id: "premier-league", name: "Premier League", type: "domestic_league", country: "England" },
  ES1: { id: "la-liga", name: "La Liga", type: "domestic_league", country: "Spain" },
  IT1: { id: "serie-a", name: "Serie A", type: "domestic_league", country: "Italy" },
  L1: { id: "bundesliga", name: "Bundesliga", type: "domestic_league", country: "Germany" },
  FR1: { id: "ligue-1", name: "Ligue 1", type: "domestic_league", country: "France" },
  NL1: { id: "eredivisie", name: "Eredivisie", type: "domestic_league", country: "Netherlands" },
  PO1: { id: "primeira-liga", name: "Primeira Liga", type: "domestic_league", country: "Portugal" },
  TR1: { id: "super-lig", name: "Süper Lig", type: "domestic_league", country: "Turkey" },
  BE1: { id: "pro-league", name: "Belgian Pro League", type: "domestic_league", country: "Belgium" },
  SC1: { id: "scottish-premiership", name: "Scottish Premiership", type: "domestic_league", country: "Scotland" },
  GB2: { id: "championship", name: "EFL Championship", type: "domestic_league", country: "England" },
  MLS1: { id: "mls", name: "Major League Soccer", type: "domestic_league", country: "USA" },
  BRA1: { id: "serie-a-brazil", name: "Brasileirão Série A", type: "domestic_league", country: "Brazil" },
  ARG1: { id: "primera-argentina", name: "Liga Profesional", type: "domestic_league", country: "Argentina" },
  CL: { id: "champions-league", name: "UEFA Champions League", type: "continental_club", country: "Europe" },
  EL: { id: "europa-league", name: "UEFA Europa League", type: "continental_club", country: "Europe" },
  ECL: { id: "conference-league", name: "UEFA Conference League", type: "continental_club", country: "Europe" },
  WMQ: { id: "world-cup-qual", name: "World Cup Qualification", type: "international_tournament", country: "International" },
  FS: { id: "friendly", name: "International Friendlies", type: "international_tournament", country: "International" },
};

export function mapCompetition(tmId, tmName = "") {
  if (!tmId) return { id: "unknown", name: tmName || "Unknown", type: "other", country: "" };
  const hit = LEAGUE_MAP[tmId];
  if (hit) return hit;
  const slug = String(tmId).toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return {
    id: `tm-${slug}`,
    name: tmName || tmId,
    type: tmId.length <= 4 ? "domestic_league" : "other",
    country: "",
  };
}

export function isContinentalCompetition(competitionId) {
  return ["champions-league", "europa-league", "conference-league"].includes(competitionId);
}

export function seasonNameToDecade(seasonName) {
  const m = String(seasonName).match(/(\d{2,4})/);
  if (!m) return "All-Time";
  let y = Number(m[1]);
  if (y < 100) y += y >= 50 ? 1900 : 2000;
  if (y < 2000) return "1990s";
  if (y < 2010) return "2000s";
  if (y < 2020) return "2010s";
  return "2020s";
}

export function seasonNameToYear(seasonName) {
  const m = String(seasonName).match(/(\d{2,4})/);
  if (!m) return null;
  let y = Number(m[1]);
  if (y < 100) y += y >= 50 ? 1900 : 2000;
  return y;
}

export function mapArchivePosition(mainPosition, positionField) {
  const raw = `${mainPosition} ${positionField}`.toLowerCase();
  if (raw.includes("goalkeeper") || raw.includes("keeper")) return "Goalkeeper";
  if (raw.includes("centre-back") || raw.includes("center-back") || raw.includes("centre back")) return "Defender";
  if (raw.includes("back") || raw.includes("wing-back")) return "Defender";
  if (raw.includes("defensive mid")) return "Midfielder";
  if (raw.includes("attacking mid") || raw.includes("offensive mid")) return "Midfielder";
  if (raw.includes("midfield")) return "Midfielder";
  if (raw.includes("winger") || raw.includes("wing")) return "Forward";
  if (raw.includes("forward") || raw.includes("striker")) return "Forward";
  if (raw.includes("attack")) return "Forward";
  if (raw.includes("defender")) return "Defender";
  return "Midfielder";
}
