import type { FormationSlotDef, Position, RatedPlayerCard } from "@sportverse/draftballer-types";

export interface SquadRuleViolation {
  code: string;
  message: string;
}

/** Position-locked squad rules engine (§6.4 / KNOWN_SIMPLIFICATIONS). */
export function validateSquadAgainstFormation(
  playerIds: string[],
  pool: Map<string, RatedPlayerCard>,
  slots: FormationSlotDef[],
  options: { strictPositionLock?: boolean } = {},
): SquadRuleViolation[] {
  const violations: SquadRuleViolation[] = [];
  const players = playerIds.map((id) => pool.get(id)).filter(Boolean) as RatedPlayerCard[];

  if (players.length !== slots.length) {
    violations.push({ code: "SQUAD_SIZE", message: `Need ${slots.length} players for this formation.` });
  }

  const gkCount = players.filter((p) => p.position === "GK").length;
  if (gkCount < 1) violations.push({ code: "NO_GK", message: "Squad requires a goalkeeper." });

  if (options.strictPositionLock) {
    const ordered = [...slots].sort((a, b) => a.slotIndex - b.slotIndex);
    for (let i = 0; i < Math.min(ordered.length, players.length); i++) {
      const slot = ordered[i]!;
      const player = players[i]!;
      if (!positionAllowed(player.position, slot.positionTag)) {
        violations.push({
          code: "POSITION_LOCK",
          message: `${player.name} (${player.position}) does not fit slot ${slot.positionTag}.`,
        });
      }
    }
  }

  return violations;
}

function positionAllowed(playerPos: Position, slotTag: string): boolean {
  if (slotTag === "GK") return playerPos === "GK";
  if (slotTag === "CB") return playerPos === "CB";
  if (slotTag === "FB") return playerPos === "FB";
  if (slotTag === "DM") return ["DM", "CM"].includes(playerPos);
  if (slotTag === "CM") return ["CM", "DM", "AM"].includes(playerPos);
  if (slotTag === "AM") return ["AM", "CM", "W"].includes(playerPos);
  if (slotTag === "W") return ["W", "AM", "FB"].includes(playerPos);
  if (slotTag === "ST") return ["ST", "AM"].includes(playerPos);
  return true;
}

export function draftPickAllowedForSlot(
  player: RatedPlayerCard,
  requiredPosition: Position,
  strict = true,
): boolean {
  if (!strict) return true;
  if (player.position === requiredPosition) return true;
  // No FB←W: a winger is not a fullback (user-visible correctness rule).
  const soft: Partial<Record<Position, Position[]>> = {
    CM: ["DM", "AM"],
    AM: ["CM", "W"],
    W: ["AM", "FB"],
    ST: ["AM"],
  };
  return soft[requiredPosition]?.includes(player.position) ?? false;
}
