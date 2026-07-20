import { getClubsExtended, getCompetitions } from "./extended.js";
import { looksLikeCompetitionId, looksLikeJunkClubAlias } from "./club-season-index.js";

function titleCaseSlug(slug: string): string {
  return slug
    .replace(/^tm[-_]/i, "")
    .split(/[-_/\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Human label for a competition id (`tm-cit` → `Italy Cup`). */
export function competitionDisplayName(competitionId: string): string {
  const id = String(competitionId ?? "").trim();
  if (!id) return "Unknown competition";
  const hit = getCompetitions().find((c) => c.id === id || c.id.toLowerCase() === id.toLowerCase());
  if (hit?.name) return hit.name;
  return titleCaseSlug(id);
}

/** Prefer real club brand names; never surface raw `tm-*` codes. */
export function clubDisplayName(raw: string | undefined | null): string {
  const name = String(raw ?? "").trim();
  if (!name) return "Unknown club";
  if (!looksLikeCompetitionId(name) && !looksLikeJunkClubAlias(name) && !/^tm[-_]/i.test(name)) {
    return name;
  }
  const lower = name.toLowerCase();
  const slug = lower.replace(/\s+/g, "-");
  const club = getClubsExtended().find(
    (c) =>
      c.id === name ||
      c.id === slug ||
      c.id.toLowerCase() === lower ||
      c.name.toLowerCase() === lower,
  );
  if (club?.name) return club.name;
  // Competition id leaked into a club field — show competition's real name.
  return competitionDisplayName(name);
}

/** Season row label: prefer clubName, else competition display name (never raw tm- codes). */
export function seasonContextLabel(row: {
  seasonLabel: string;
  competitionId: string;
  clubName?: string;
}): string {
  const club =
    row.clubName && !looksLikeCompetitionId(row.clubName) && !looksLikeJunkClubAlias(row.clubName)
      ? clubDisplayName(row.clubName)
      : null;
  if (club) return `${row.seasonLabel} · ${club}`;
  return `${row.seasonLabel} · ${competitionDisplayName(row.competitionId)}`;
}
