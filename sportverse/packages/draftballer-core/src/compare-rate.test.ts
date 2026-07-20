import { describe, expect, it } from "vitest";
import { getPresetMode, ratePlayerById } from "./index.js";
import { getDraftPlayers } from "@sportverse/sports-db";

describe("ratePlayerById — compare view offline path", () => {
  it("rates the same player under club vs international lenses with divergent raws", () => {
    const players = getDraftPlayers();
    const id = players.find((p) => p.id === "messi")?.id ?? players[0]?.id;
    expect(id).toBeTruthy();

    const club = ratePlayerById(id!, getPresetMode("club-only"));
    const intl = ratePlayerById(id!, getPresetMode("international"));
    expect(club).not.toBeNull();
    expect(intl).not.toBeNull();
    expect(club!.breakdown.lens).toBe("club_only");
    expect(intl!.breakdown.lens).toBe("international_only");
    // Both produce finite explainable cards (Bible §8.2.5 presentation path).
    expect(club!.ovr).toBeGreaterThan(0);
    expect(intl!.ovr).toBeGreaterThan(0);
    expect(club!.breakdown.ratingBasis).toBe("prime");
  });

  it("returns null for unknown player ids", () => {
    expect(ratePlayerById("definitely-not-a-player-xyz", getPresetMode("all-time-any"))).toBeNull();
  });
});
