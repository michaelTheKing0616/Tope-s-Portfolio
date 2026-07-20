import type { RatedPlayerCard } from "@sportverse/draftballer-types";

const TEMPLATES: { match: (players: RatedPlayerCard[]) => boolean; label: string }[] = [
  {
    match: (p) => p.filter((x) => x.position === "ST" || x.position === "W").length >= 5,
    label: "All Gas, No Brakes",
  },
  {
    match: (p) => {
      const nats = new Set(p.map((x) => x.nationality.split(" ")[0]));
      return p.filter((x) => x.nationality.includes("Brazil")).length >= 3;
    },
    label: "Joga Bonito",
  },
  {
    match: (p) => p.every((x) => (x.breakdown.leagueContext?.competitionId ?? "").includes("premier")),
    label: "Premier League Purists",
  },
  {
    match: (p) => p.filter((x) => x.fameTier === "icon").length >= 3,
    label: "Galácticos",
  },
  {
    match: (p) => p.filter((x) => x.fameTier === "obscure" || x.fameTier === "cult").length >= 7,
    label: "Underdogs United",
  },
  {
    match: (p) => p.reduce((s, x) => s + x.ovr, 0) / p.length < 80,
    label: "Moneyball FC",
  },
  {
    match: (p) => p.filter((x) => x.position === "GK" || x.position === "CB" || x.position === "FB").length >= 7,
    label: "Fortress Mode",
  },
  {
    match: (p) => new Set(p.map((x) => x.nationality)).size >= 8,
    label: "United Nations XI",
  },
];

export function generateTeamIdentity(players: RatedPlayerCard[]): string {
  if (!players.length) return "Mystery XI";
  for (const t of TEMPLATES) {
    if (t.match(players)) return t.label;
  }
  const avg = Math.round(players.reduce((s, p) => s + p.ovr, 0) / players.length);
  if (avg >= 88) return "Title Favourites";
  if (avg >= 82) return "European Aspirants";
  return "Mid-Table Merchants";
}

export function challengeShareText(record: string, identity: string, seed: string, origin = ""): string {
  const base = origin || (typeof window !== "undefined" ? window.location.origin + window.location.pathname : "");
  return `I went ${record} with my "${identity}" XI on DRAFTBALLER. Same wheel, beat me: ${base}#/draftballer/challenge/${encodeURIComponent(seed)}`;
}
