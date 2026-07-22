import { describe, expect, it } from "vitest";
import type { RatedPlayerCard } from "@sportverse/draftballer-types";
import { getEraProfile } from "./era-profiles.js";
import { computeIntelligentMatchRates, styleClashBias } from "./match-intelligence.js";
import { computeAnachronismTerm, playerPeakEraId } from "./fit-model.js";
import { computePlayerMeta } from "./player-meta.js";

function xi(ovr: number): RatedPlayerCard[] {
  const positions = ["GK", "CB", "CB", "FB", "FB", "CM", "CM", "AM", "W", "W", "ST"] as const;
  return positions.map((position, i) => ({
    playerId: `p${i}`,
    name: `P${i}`,
    nationality: "T",
    position,
    ovr: ovr + (i % 3) - 1,
    tier: "gold" as const,
    attributes: {
      pac: ovr,
      sho: ovr - (position === "GK" ? 30 : 0),
      pas: ovr,
      dri: ovr,
      def: ovr - (position === "ST" ? 20 : 0),
      phy: ovr,
    },
    confidence: 0.9,
    breakdown: {
      clubOvrRaw: ovr,
      intlOvrRaw: ovr,
      awardBonus: 0,
      lens: "club_only" as const,
      blendFactor: 0,
    },
  }));
}

describe("match intelligence engine", () => {
  it("elite vs weak produces decisive λ ≫ μ", () => {
    const rates = computeIntelligentMatchRates({
      homePlayers: xi(88),
      awayPlayers: xi(62),
      formationHomeId: "4-3-3",
      formationAwayId: "4-4-2",
      homeAdvantage: true,
      era: getEraProfile("2020s"),
      tacticalIdentityHome: "high_press",
      tacticalIdentityAway: "balanced",
    });
    expect(rates.lambda).toBeGreaterThan(rates.mu + 0.7);
    expect(rates.lambda).toBeGreaterThan(1.3);
  });

  it("style clash favors press in modern tempo", () => {
    const modern = getEraProfile("2020s");
    const hard = getEraProfile("1970s-80s");
    expect(styleClashBias("high_press", "balanced", modern)).toBeGreaterThan(
      styleClashBias("high_press", "balanced", hard),
    );
  });

  it("anachronism taxes modern technicians in hard-men eras", () => {
    const era = getEraProfile("1970s-80s");
    const card = xi(85)[7]!; // AM
    const meta = computePlayerMeta(card);
    const term = computeAnachronismTerm(era, card.attributes, meta, "2020s");
    expect(term).toBeLessThan(0);
  });

  it("playerPeakEraId reads busiest season", () => {
    const id = playerPeakEraId([
      {
        playerId: "x",
        seasonLabel: "05/06",
        competitionId: "premier-league",
        appearances: 20,
        minutes: 1800,
        goals: 2,
        assists: 1,
      } as never,
      {
        playerId: "x",
        seasonLabel: "18/19",
        competitionId: "premier-league",
        appearances: 30,
        minutes: 2700,
        goals: 5,
        assists: 4,
      } as never,
    ]);
    expect(id).toBe("2010s");
  });
});
