import { describe, expect, it } from "vitest";
import { createApp } from "../src/server.js";
import { PlayerStore } from "../src/store.js";
import { join } from "node:path";
import { tmpdir } from "node:os";

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
});
