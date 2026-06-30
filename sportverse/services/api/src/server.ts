import { createServer } from "node:net";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import type { PlayerProfile, RewardGrant } from "@sportverse/platform";
import { loadConfig, PlayerStore } from "./store.js";

export function createApp(store: PlayerStore) {
  const app = new Hono();
  app.use("/*", cors());

  app.get("/health", (c) => c.json({ ok: true, service: "sportverse-api", version: "0.1.0" }));

  app.get("/api/players/:id", (c) => {
    const p = store.get(c.req.param("id"));
    if (!p) return c.json({ error: "Not found" }, 404);
    return c.json(p);
  });

  app.post("/api/players", async (c) => {
    const body = await c.req.json<{ displayName?: string }>();
    const id = `player_${crypto.randomUUID().slice(0, 12)}`;
    const profile = store.getOrCreate(id, body.displayName ?? "Rookie");
    profile.isGuest = false;
    return c.json(store.save(profile), 201);
  });

  app.put("/api/players/:id", async (c) => {
    const body = (await c.req.json()) as PlayerProfile;
    if (body.id !== c.req.param("id")) return c.json({ error: "ID mismatch" }, 400);
    return c.json(store.save(body));
  });

  app.post("/api/players/:id/reward", async (c) => {
    const reward = (await c.req.json()) as RewardGrant;
    return c.json(store.grant(c.req.param("id"), reward));
  });

  app.get("/api/leaderboard", (c) => c.json(store.leaderboard()));

  app.get("/api/daily", (c) => {
    const modes = ["who-am-i", "speed-round", "true-false", "guess-club", "career-path"];
    const day = new Date().toISOString().slice(0, 10);
    const idx = day.split("-").reduce((a, b) => a + Number(b), 0) % modes.length;
    return c.json({ mode: modes[idx], seed: day, bonusXp: 50 });
  });

  return app;
}

/** Returns true if port is free to bind. */
function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once("error", () => resolve(false));
    probe.once("listening", () => {
      probe.close(() => resolve(true));
    });
    probe.listen(port);
  });
}

export async function resolvePort(preferred: number, maxTries = 10): Promise<number> {
  for (let i = 0; i < maxTries; i++) {
    const port = preferred + i;
    if (await isPortFree(port)) return port;
  }
  throw new Error(`No free port found from ${preferred} to ${preferred + maxTries - 1}`);
}

export async function startServer() {
  const config = loadConfig();
  const store = new PlayerStore(config.databasePath);
  const app = createApp(store);
  const port = await resolvePort(config.port);

  if (port !== config.port) {
    console.warn(
      `Port ${config.port} is in use (likely a previous API instance). Using http://localhost:${port} instead.`,
    );
    console.warn(`To free ${config.port}: netstat -ano | findstr :${config.port}  then  taskkill /PID <pid> /F`);
  }

  serve({ fetch: app.fetch, port });
  return { app, port };
}
