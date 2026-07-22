import { describe, expect, it } from "vitest";
import type { RatedPlayerCard, SimSquadInput } from "@sportverse/draftballer-types";
import { simulateSeason } from "./season.js";

/**
 * Season realism calibration — guards against the "19-draw, 28-goal season"
 * failure mode. Bands follow real top-flight football:
 *   • total goals/game ≈ 2.3–3.3 (modern era)
 *   • draws ≈ 15–35% for a competitive side, lower for an elite one
 *   • an 86-OVR draft vs a normal league should fight for the title (70+ pts)
 *   • a 68-OVR draft should NOT rack up 70 pts
 */

/** Realistic position-shaped attributes — GKs don't shoot, STs don't tackle. */
function shapedAttrs(ovr: number, position: RatedPlayerCard["position"]) {
  const hi = ovr + 4;
  const mid = ovr - 4;
  const lo = Math.max(30, ovr - 32);
  switch (position) {
    case "GK":
      return { pac: lo + 10, sho: lo, pas: mid, dri: lo + 8, def: hi, phy: ovr };
    case "CB":
      return { pac: mid, sho: lo, pas: mid, dri: lo + 12, def: hi, phy: hi };
    case "FB":
      return { pac: hi, sho: lo + 10, pas: mid, dri: mid, def: ovr, phy: mid };
    case "DM":
      return { pac: mid, sho: lo + 12, pas: ovr, dri: mid, def: hi, phy: ovr };
    case "CM":
      return { pac: mid, sho: mid, pas: hi, dri: ovr, def: mid, phy: mid };
    case "AM":
      return { pac: ovr, sho: ovr, pas: hi, dri: hi, def: lo, phy: lo + 10 };
    case "W":
      return { pac: hi, sho: ovr, pas: mid, dri: hi, def: lo, phy: lo + 8 };
    default: // ST
      return { pac: ovr, sho: hi, pas: mid, dri: ovr, def: lo, phy: ovr };
  }
}

function realisticSquad(ovr: number, name = "Calib XI"): SimSquadInput {
  const positions: RatedPlayerCard["position"][] = [
    "GK", "CB", "CB", "FB", "FB", "CM", "CM", "AM", "W", "W", "ST",
  ];
  const players = positions.map((pos, i) => {
    const pOvr = ovr + (i % 3) - 1;
    return {
      playerId: `cal${i}`,
      name: `Cal ${pos} ${i}`,
      nationality: "Test",
      position: pos,
      ovr: pOvr,
      tier: "gold" as const,
      attributes: shapedAttrs(pOvr, pos),
      confidence: 0.9,
      breakdown: {
        clubOvrRaw: pOvr,
        intlOvrRaw: pOvr,
        awardBonus: 0,
        lens: "club_only" as const,
        blendFactor: 0,
      },
    };
  });
  return {
    name,
    playerIds: players.map((p) => p.playerId),
    players,
    squadOvr: Math.round(players.reduce((s, p) => s + p.ovr, 0) / players.length),
  };
}

async function seasonStats(ovr: number, runs: number) {
  let pts = 0;
  let gf = 0;
  let ga = 0;
  let dr = 0;
  let w = 0;
  for (let i = 0; i < runs; i++) {
    const r = await simulateSeason(realisticSquad(ovr), `calib-${ovr}-${i}`);
    pts += r.points;
    gf += r.goalsFor;
    ga += r.goalsAgainst;
    dr += r.drawn;
    w += r.won;
  }
  return {
    points: pts / runs,
    goalsFor: gf / runs,
    goalsAgainst: ga / runs,
    draws: dr / runs,
    wins: w / runs,
    totalGpg: (gf + ga) / runs / 38,
  };
}

describe("season realism calibration", () => {
  it("86-OVR elite draft: title-contender points, real goal volume, sane draws", async () => {
    const s = await seasonStats(86, 8);
    // eslint-disable-next-line no-console
    console.log("[calib 86]", JSON.stringify(s));
    expect(s.points).toBeGreaterThan(68);
    expect(s.points).toBeLessThan(105);
    expect(s.goalsFor).toBeGreaterThan(62);
    // Elite sides shouldn't grind out 12+ draws — target ~15–25% max.
    expect(s.draws).toBeLessThan(10);
    expect(s.totalGpg).toBeGreaterThan(2.3);
    expect(s.totalGpg).toBeLessThan(4.0);
  }, 120000);

  it("75-OVR mid draft: mid-table band with realistic draw share", async () => {
    const s = await seasonStats(75, 8);
    // eslint-disable-next-line no-console
    console.log("[calib 75]", JSON.stringify(s));
    expect(s.points).toBeGreaterThan(38);
    expect(s.points).toBeLessThan(78);
    expect(s.draws).toBeGreaterThan(4);
    // Real top-flight draw share ≈ 22–28% (~8–11/38); refuse the 15–19 draw grind.
    expect(s.draws).toBeLessThan(13);
    expect(s.totalGpg).toBeGreaterThan(2.3);
    expect(s.totalGpg).toBeLessThan(3.6);
  }, 120000);

  it("66-OVR weak draft: struggles, does not overachieve", async () => {
    const s = await seasonStats(66, 8);
    // eslint-disable-next-line no-console
    console.log("[calib 66]", JSON.stringify(s));
    expect(s.points).toBeLessThan(55);
    expect(s.goalsAgainst).toBeGreaterThan(s.goalsFor - 10);
  }, 120000);

  it("stronger drafts strictly out-point weaker ones", async () => {
    const hi = await seasonStats(88, 5);
    const lo = await seasonStats(70, 5);
    expect(hi.points).toBeGreaterThan(lo.points + 15);
  }, 120000);
});
