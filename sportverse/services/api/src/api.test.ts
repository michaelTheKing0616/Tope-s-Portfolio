import { describe, expect, it } from "vitest";
import { createApp } from "../src/server.js";
import { PlayerStore } from "../src/store.js";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { RatedPlayerCard } from "@sportverse/draftballer-types";

function mockSquad(): { squad: { name: string; playerIds: string[]; players: RatedPlayerCard[]; squadOvr: number } } {
  const positions: RatedPlayerCard["position"][] = ["GK", "CB", "CB", "FB", "FB", "CM", "CM", "AM", "W", "W", "ST"];
  const players = positions.map((position, i) => ({
    playerId: `p${i}`,
    name: `Player ${i}`,
    nationality: "Test",
    position,
    ovr: 75 + i,
    tier: "gold" as const,
    attributes: { pac: 70, sho: 70, pas: 70, dri: 70, def: 70, phy: 70 },
    confidence: 0.9,
    breakdown: { clubOvrRaw: 75, intlOvrRaw: 75, awardBonus: 0, lens: "club_only" as const, blendFactor: 0 },
  }));
  return {
    squad: {
      name: "Test XI",
      playerIds: players.map((p) => p.playerId),
      players,
      squadOvr: 78,
    },
  };
}

describe("api", () => {
  it("returns health and daily challenge", async () => {
    const store = new PlayerStore(join(tmpdir(), `sv-test-${Date.now()}.json`));
    const app = createApp(store);

    const health = await app.request("/health");
    expect(health.status).toBe(200);

    const daily = await app.request("/api/daily");
    const body = (await daily.json()) as { mode: string; bonusXp: number };
    expect(body.bonusXp).toBe(50);
    expect(body.mode).toBeTruthy();
  });

  it("creates and rewards a player", async () => {
    const store = new PlayerStore(join(tmpdir(), `sv-test-${Date.now()}.json`));
    const app = createApp(store);

    const create = await app.request("/api/players", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName: "Tester" }),
    });
    expect(create.status).toBe(201);
    const player = (await create.json()) as { id: string; xp: number };

    const reward = await app.request(`/api/players/${player.id}/reward`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ xp: 100, coins: 10 }),
    });
    const updated = (await reward.json()) as { xp: number; coins: number };
    expect(updated.xp).toBeGreaterThan(player.xp);
    expect(updated.coins).toBeGreaterThan(0);
  });

  it("lists canonical formations", async () => {
    const store = new PlayerStore(join(tmpdir(), `sv-test-${Date.now()}.json`));
    const app = createApp(store);
    const res = await app.request("/api/formations");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { formations: { id: string }[] };
    expect(body.formations.length).toBeGreaterThanOrEqual(13);
    expect(body.formations.some((f) => f.id === "4-4-2")).toBe(true);
  });

  it("simulates match with fit report", async () => {
    const store = new PlayerStore(join(tmpdir(), `sv-test-${Date.now()}.json`));
    const app = createApp(store);
    const { squad } = mockSquad();
    const res = await app.request("/api/squads/local/simulate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        squad,
        opponentSquad: { ...squad, name: "Rival" },
        simulationMode: "realistic",
        eraContext: { mode: "custom", profileId: "1970s-80s" },
        formationHome: "3-4-3",
        formationAway: "4-4-2",
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { fit_report: unknown[]; eraProfileId: string };
    expect(body.eraProfileId).toBe("1970s-80s");
    expect(body.fit_report.length).toBeGreaterThan(0);
  });
});
