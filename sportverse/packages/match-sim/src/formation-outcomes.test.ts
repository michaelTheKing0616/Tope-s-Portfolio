import { describe, expect, it } from "vitest";
import type { RatedPlayerCard, SimSquadInput } from "@sportverse/draftballer-types";
import { DEFAULT_SIM_CONFIG } from "@sportverse/draftballer-types";
import { simulateMatchV2 } from "./sim-engine.js";
import { getFormation } from "./formations.js";
import { overloadCommentary } from "./commentary-v2.js";

const POS: RatedPlayerCard["position"][] = ["GK", "CB", "FB", "DM", "CM", "AM", "W", "ST"];

function toPos(tag: string): RatedPlayerCard["position"] {
  const t = tag.toUpperCase();
  if ((POS as string[]).includes(t)) return t as RatedPlayerCard["position"];
  if (t === "LW" || t === "RW") return "W";
  if (t === "CF") return "ST";
  return "CM";
}

function mockPlayer(
  id: string,
  attrs: Partial<RatedPlayerCard["attributes"]>,
  position: RatedPlayerCard["position"],
): RatedPlayerCard {
  const base = { pac: 70, sho: 70, pas: 70, dri: 70, def: 70, phy: 70, ...attrs };
  const ovr = Math.round((base.pac + base.sho + base.pas + base.dri + base.def + base.phy) / 6);
  return {
    playerId: id,
    name: id,
    nationality: "Test",
    position,
    ovr,
    tier: "gold",
    fameScore: 50,
    fameTier: "known",
    attributes: base,
    confidence: 0.9,
    breakdown: { clubOvrRaw: ovr, intlOvrRaw: ovr, awardBonus: 0, lens: "club_only", blendFactor: 0 },
  };
}

function squadForFormation(formationId: string, prefix: string): SimSquadInput {
  const slots = getFormation(formationId).slots;
  const players = slots.map((s, i) =>
    mockPlayer(`${prefix}${i}`, { sho: 72 + (i % 5), phy: 68 + (i % 4) }, toPos(s.positionTag)),
  );
  return {
    name: prefix,
    playerIds: players.map((p) => p.playerId),
    players,
    squadOvr: Math.round(players.reduce((s, p) => s + p.ovr, 0) / players.length),
    formationId,
  } as SimSquadInput & { formationId: string };
}

describe("formation choice changes sim outcomes", () => {
  it("4-3-3 vs 5-3-2 same players produce different GD distributions over seeded runs", () => {
    const away = squadForFormation("4-4-2", "opp");
    const gd433: number[] = [];
    const gd532: number[] = [];
    for (let i = 0; i < 24; i++) {
      const seed = `form-gd-${i}`;
      const r433 = simulateMatchV2(squadForFormation("4-3-3", "h"), away, seed, 1, {
        config: {
          ...DEFAULT_SIM_CONFIG,
          simulationMode: "realistic",
          formationHomeId: "4-3-3",
          formationAwayId: "4-4-2",
          weather: "clear",
        },
      });
      const r532 = simulateMatchV2(squadForFormation("5-3-2", "h"), away, seed, 1, {
        config: {
          ...DEFAULT_SIM_CONFIG,
          simulationMode: "realistic",
          formationHomeId: "5-3-2",
          formationAwayId: "4-4-2",
          weather: "clear",
        },
      });
      gd433.push(r433.homeGoals - r433.awayGoals);
      gd532.push(r532.homeGoals - r532.awayGoals);
    }
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const hist = (xs: number[]) => xs.join(",");
    // Distributions must differ (not identical sequence).
    expect(hist(gd433)).not.toBe(hist(gd532));
    // Sanity: both produce finite football scores
    expect(Number.isFinite(mean(gd433))).toBe(true);
    expect(Number.isFinite(mean(gd532))).toBe(true);
  });

  it("overloadCommentary mentions tactical matchup", () => {
    expect(overloadCommentary("City", "att_left", 0.1, "4-3-3", "5-3-2")).toMatch(/Tactical matchup/);
  });
});
