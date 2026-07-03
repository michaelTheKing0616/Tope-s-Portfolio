import type { FormationSlotDef } from "@sportverse/draftballer-types";
import type { PlayerAttributes, Position, RatedPlayerCard } from "@sportverse/draftballer-types";

const ROLE_WEIGHTS: Record<string, Partial<Record<keyof PlayerAttributes, number>>> = {
  destroyer: { def: 1.15, phy: 1.1, pas: 0.9 },
  box_to_box: { phy: 1.08, pas: 1.05, def: 1.05 },
  playmaker: { pas: 1.12, dri: 1.1, sho: 0.95 },
  false_nine: { dri: 1.12, pas: 1.1, sho: 1.05, phy: 0.9 },
  target_man: { phy: 1.15, sho: 1.08, dri: 0.88 },
  overlapping_wb: { pac: 1.12, pas: 1.05, def: 1.05 },
  inverted_fb: { pas: 1.1, dri: 1.08, def: 1.05 },
  ball_playing_cb: { pas: 1.12, def: 1.08, dri: 1.05 },
};

const POSITION_ROLE_DEFAULTS: Partial<Record<Position, string>> = {
  ST: "target_man",
  AM: "playmaker",
  DM: "destroyer",
  CM: "box_to_box",
  FB: "overlapping_wb",
  CB: "ball_playing_cb",
};

function inferPlayerRole(player: RatedPlayerCard): string {
  const { pac, sho, pas, dri, def, phy } = player.attributes;
  const tri = (dri + pas) / (dri + pas + phy + def + 0.01);
  if (player.position === "ST" && tri > 0.55) return "false_nine";
  if (player.position === "ST") return "target_man";
  if (player.position === "AM" || player.position === "CM") return tri > 0.52 ? "playmaker" : "box_to_box";
  if (player.position === "DM") return "destroyer";
  if (player.position === "FB" && pas > def) return "inverted_fb";
  if (player.position === "FB") return "overlapping_wb";
  if (player.position === "CB" && pas > 65) return "ball_playing_cb";
  return POSITION_ROLE_DEFAULTS[player.position] ?? "box_to_box";
}

function positionMatchScore(playerPos: Position, slotTag: string): number {
  const map: Record<string, Position[]> = {
    GK: ["GK"],
    CB: ["CB"],
    FB: ["FB"],
    DM: ["DM"],
    CM: ["CM", "DM", "AM"],
    AM: ["AM", "CM", "W"],
    W: ["W", "AM", "FB"],
    ST: ["ST", "AM"],
  };
  const allowed = map[slotTag] ?? [playerPos];
  if (allowed.includes(playerPos)) return 1;
  if (allowed.includes("CM") && ["DM", "AM"].includes(playerPos)) return 0.85;
  return 0.65;
}

/** Formation role fit modifier — slot role vs inferred player role (§4 fast-follow). */
export function roleFitModifier(player: RatedPlayerCard, slot: FormationSlotDef): number {
  const posFit = positionMatchScore(player.position, slot.positionTag);
  const playerRole = inferPlayerRole(player);
  const slotRole = slot.roleTag ?? POSITION_ROLE_DEFAULTS[player.position] ?? "box_to_box";
  const roleMatch = playerRole === slotRole ? 1 : playerRole.includes(slotRole) || slotRole.includes(playerRole) ? 0.92 : 0.88;
  return clamp(-0.08, 0.08, (posFit * roleMatch - 0.92) * 0.5);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function assignPlayersToFormationSlots(
  players: RatedPlayerCard[],
  formationId: string,
  getFormation: (id: string) => { slots: FormationSlotDef[] },
): Map<string, FormationSlotDef> {
  const formation = getFormation(formationId);
  const slots = [...formation.slots].sort((a, b) => a.slotIndex - b.slotIndex);
  const available = [...players];
  const assignment = new Map<string, FormationSlotDef>();

  for (const slot of slots) {
    let best: RatedPlayerCard | null = null;
    let bestScore = -1;
    for (const p of available) {
      const score = positionMatchScore(p.position, slot.positionTag) + (inferPlayerRole(p) === slot.roleTag ? 0.2 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (best) {
      assignment.set(best.playerId, slot);
      available.splice(available.indexOf(best), 1);
    }
  }
  return assignment;
}

export { inferPlayerRole, ROLE_WEIGHTS };
