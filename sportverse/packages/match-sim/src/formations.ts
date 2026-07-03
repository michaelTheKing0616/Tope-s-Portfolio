import type { PitchZone, TacticalIdentity } from "@sportverse/draftballer-types";

function zoneFromXY(x: number, y: number): PitchZone {
  const xBand = x < 33 ? "def" : x < 66 ? "mid" : "att";
  const yBand = y < 33 ? "left" : y < 66 ? "center" : "right";
  return `${xBand}_${yBand}` as PitchZone;
}

function slot(
  index: number,
  positionTag: string,
  x: number,
  y: number,
  roleTag?: string,
) {
  return {
    slotIndex: index,
    positionTag,
    roleTag,
    x,
    y,
    zoneId: zoneFromXY(x, y),
  };
}

function buildFormation(
  id: string,
  name: string,
  backLine: number,
  width: "narrow" | "balanced" | "wide",
  eraTags: string[],
  coords: Array<[string, number, number, string?]>,
) {
  return {
    id,
    name,
    backLineCount: backLine,
    widthCategory: width,
    eraTags,
    slots: coords.map(([pos, x, y, role], i) => slot(i, pos, x, y, role)),
  };
}

/** Formation System v1 §1.3 canonical library */
export const FORMATIONS = [
  buildFormation("2-3-5", "2-3-5 Pyramid", 2, "wide", ["1870s", "1920s"], [
    ["GK", 5, 50],
    ["CB", 18, 35],
    ["CB", 18, 65],
    ["CM", 45, 25],
    ["CM", 45, 50],
    ["CM", 45, 75],
    ["ST", 78, 15],
    ["ST", 78, 38],
    ["ST", 78, 62],
    ["ST", 78, 85],
    ["ST", 82, 50],
  ]),
  buildFormation("wm", "W-M (3-2-2-3)", 3, "balanced", ["1930s", "1950s"], [
    ["GK", 5, 50],
    ["CB", 18, 30],
    ["CB", 18, 50],
    ["CB", 18, 70],
    ["CM", 42, 38],
    ["CM", 42, 62],
    ["AM", 58, 38],
    ["AM", 58, 62],
    ["ST", 78, 25],
    ["ST", 78, 50],
    ["ST", 78, 75],
  ]),
  buildFormation("4-4-2", "4-4-2 Classic", 4, "balanced", ["1970s", "2000s"], [
    ["GK", 5, 50],
    ["FB", 18, 12],
    ["CB", 18, 38],
    ["CB", 18, 62],
    ["FB", 18, 88],
    ["W", 42, 12],
    ["CM", 42, 38],
    ["CM", 42, 62],
    ["W", 42, 88],
    ["ST", 75, 40],
    ["ST", 75, 60],
  ]),
  buildFormation("4-4-2-diamond", "4-4-2 Diamond", 4, "narrow", ["1990s", "2010s"], [
    ["GK", 5, 50],
    ["FB", 18, 18],
    ["CB", 18, 42],
    ["CB", 18, 58],
    ["FB", 18, 82],
    ["DM", 38, 50],
    ["CM", 48, 42],
    ["CM", 48, 58],
    ["AM", 58, 50],
    ["ST", 75, 42],
    ["ST", 75, 58],
  ]),
  buildFormation("4-3-3", "4-3-3", 4, "wide", ["2000s", "2020s"], [
    ["GK", 5, 50],
    ["FB", 18, 12],
    ["CB", 18, 38],
    ["CB", 18, 62],
    ["FB", 18, 88],
    ["CM", 45, 30],
    ["CM", 45, 50],
    ["CM", 45, 70],
    ["W", 72, 12],
    ["ST", 72, 50],
    ["W", 72, 88],
  ]),
  buildFormation("4-2-3-1", "4-2-3-1", 4, "balanced", ["2010s", "2020s"], [
    ["GK", 5, 50],
    ["FB", 18, 12],
    ["CB", 18, 38],
    ["CB", 18, 62],
    ["FB", 18, 88],
    ["DM", 38, 38],
    ["DM", 38, 62],
    ["W", 58, 12],
    ["AM", 58, 50],
    ["W", 58, 88],
    ["ST", 75, 50],
  ]),
  buildFormation("4-1-4-1", "4-1-4-1", 4, "balanced", ["2010s", "2020s"], [
    ["GK", 5, 50],
    ["FB", 18, 12],
    ["CB", 18, 38],
    ["CB", 18, 62],
    ["FB", 18, 88],
    ["DM", 35, 50],
    ["W", 50, 12],
    ["CM", 50, 38],
    ["CM", 50, 62],
    ["W", 50, 88],
    ["ST", 72, 50],
  ]),
  buildFormation("4-5-1", "4-5-1", 4, "narrow", ["1990s", "2000s"], [
    ["GK", 5, 50],
    ["FB", 18, 15],
    ["CB", 18, 38],
    ["CB", 18, 62],
    ["FB", 18, 85],
    ["W", 45, 15],
    ["CM", 45, 35],
    ["CM", 45, 50],
    ["CM", 45, 65],
    ["W", 45, 85],
    ["ST", 72, 50],
  ]),
  buildFormation("3-5-2", "3-5-2", 3, "wide", ["1990s", "2020s"], [
    ["GK", 5, 50],
    ["CB", 18, 30],
    ["CB", 18, 50],
    ["CB", 18, 70],
    ["FB", 42, 8],
    ["CM", 45, 35],
    ["CM", 45, 50],
    ["CM", 45, 65],
    ["FB", 42, 92],
    ["ST", 75, 42],
    ["ST", 75, 58],
  ]),
  buildFormation("3-4-3", "3-4-3", 3, "wide", ["2010s", "2020s"], [
    ["GK", 5, 50],
    ["CB", 18, 30],
    ["CB", 18, 50],
    ["CB", 18, 70],
    ["FB", 42, 8],
    ["CM", 45, 38],
    ["CM", 45, 62],
    ["FB", 42, 92],
    ["W", 72, 15],
    ["ST", 72, 50],
    ["W", 72, 85],
  ]),
  buildFormation("3-4-2-1", "3-4-2-1", 3, "balanced", ["2010s", "2020s"], [
    ["GK", 5, 50],
    ["CB", 18, 30],
    ["CB", 18, 50],
    ["CB", 18, 70],
    ["FB", 42, 8],
    ["CM", 45, 38],
    ["CM", 45, 62],
    ["FB", 42, 92],
    ["AM", 62, 38],
    ["AM", 62, 62],
    ["ST", 75, 50],
  ]),
  buildFormation("5-3-2", "5-3-2", 5, "wide", ["1990s", "2020s"], [
    ["GK", 5, 50],
    ["FB", 15, 8],
    ["CB", 18, 28],
    ["CB", 18, 50],
    ["CB", 18, 72],
    ["FB", 15, 92],
    ["CM", 45, 30],
    ["CM", 45, 50],
    ["CM", 45, 70],
    ["ST", 72, 42],
    ["ST", 72, 58],
  ]),
  buildFormation("4-3-1-2", "4-3-1-2", 4, "narrow", ["1990s", "2000s"], [
    ["GK", 5, 50],
    ["FB", 18, 15],
    ["CB", 18, 40],
    ["CB", 18, 60],
    ["FB", 18, 85],
    ["CM", 45, 30],
    ["CM", 45, 50],
    ["CM", 45, 70],
    ["AM", 58, 50],
    ["ST", 75, 42],
    ["ST", 75, 58],
  ]),
];

const formationMap = new Map(FORMATIONS.map((f) => [f.id, f]));

export function getFormation(id: string) {
  return formationMap.get(id) ?? formationMap.get("4-4-2")!;
}

export function listFormations() {
  return FORMATIONS;
}

export function zonePresence(formationId: string): Record<PitchZone, number> {
  const f = getFormation(formationId);
  const counts: Record<PitchZone, number> = {
    def_left: 0,
    def_center: 0,
    def_right: 0,
    mid_left: 0,
    mid_center: 0,
    mid_right: 0,
    att_left: 0,
    att_center: 0,
    att_right: 0,
  };
  for (const s of f.slots) {
    if (s.positionTag === "GK") {
      counts.def_center++;
      continue;
    }
    counts[s.zoneId]++;
  }
  return counts;
}

const DELTA = 0.05;

/** §3.3 Zone overload modifier for attacking team in zone z */
export function zoneOverloadModifier(
  attackingFormationId: string,
  defendingFormationId: string,
  zone: PitchZone,
): number {
  const atk = zonePresence(attackingFormationId);
  const def = zonePresence(defendingFormationId);
  const delta = atk[zone] - def[zone];
  return Math.max(-0.15, Math.min(0.15, DELTA * delta));
}

export function formationsForEra(decade?: string): typeof FORMATIONS {
  if (!decade) return FORMATIONS;
  const d = decade.replace("s", "");
  return [...FORMATIONS].sort((a, b) => {
    const aHit = a.eraTags.some((t) => t.includes(d)) ? 1 : 0;
    const bHit = b.eraTags.some((t) => t.includes(d)) ? 1 : 0;
    return bHit - aHit;
  });
}

export function generatePreMatchHeadline(
  homeTri: number,
  awayTri: number,
  homeName: string,
  awayName: string,
): string {
  const homeLabel = homeTri >= 0.55 ? "The Technicians" : homeTri <= 0.35 ? "The Iron Wall" : homeName;
  const awayLabel = awayTri >= 0.55 ? "The Technicians" : awayTri <= 0.35 ? "The Iron Wall" : awayName;
  return `${homeLabel} vs ${awayLabel}`;
}
