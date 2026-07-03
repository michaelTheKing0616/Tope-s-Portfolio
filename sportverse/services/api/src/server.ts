import { createServer } from "node:http";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import type { PlayerProfile, RewardGrant } from "@sportverse/platform";
import {
  getDraftPlayers,
  getSeasonStats,
  searchPlayers,
  getCompetitions,
  poolCounts,
  getAwards,
  getIconicMoments,
  __setExtendedDataForTests,
} from "@sportverse/sports-db";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getPresetMode,
  buildDraftPool,
  previewPool,
  serverApplyPick,
  serverAuctionBid,
  serverBlindPick,
  serverNominateAuction,
  serverResolveAuction,
  serverResolveBlind,
  startPicking,
  advanceToPoolReady,
} from "@sportverse/draftballer-core";
import { computePlayerRating, setAwardsData, setCalibrationData, poolCacheStats } from "@sportverse/rating-engine";
import type { SimMatchConfig, SimSquadInputV2 } from "@sportverse/draftballer-types";
import { DEFAULT_SIM_CONFIG } from "@sportverse/draftballer-types";
import { simulateEraLab, simulateMatchV2 } from "@sportverse/match-sim";
import { loadConfig, PlayerStore } from "./store.js";
import { createRoomViaHttp } from "./ws.js";
import { getRoom, saveRoom, roomCount, reloadPersistedRooms } from "./draft-room/store.js";
import { attachDraftSocket } from "./ws.js";
import { getFormationByIdPersisted, listAllFormationsWithCustom, savePersistedCustomFormation } from "./persistence/formations-persist.js";
import { addDailyScore, getDailyScores } from "./persistence/daily-leaderboard.js";
import { persistRoom, loadPersistedRooms } from "./persistence/draft-rooms-persist.js";

export function createApp(store: PlayerStore) {
  const app = new Hono();
  app.use("/*", cors());

  app.get("/health", (c) =>
    c.json({ ok: true, service: "sportverse-api", version: "0.2.0", draftRooms: roomCount() }),
  );

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
    const day = new Date().toISOString().slice(0, 10);
    const modes = ["all-time-any", "decade-2010s", "premier-league", "continental-cl"];
    const idx = day.split("-").reduce((a, b) => a + Number(b), 0) % modes.length;
    return c.json({
      modeId: modes[idx],
      mode: modes[idx],
      seed: day,
      bonusXp: 50,
      leaderboard: getDailyScores(day),
    });
  });

  app.post("/api/daily/score", async (c) => {
    const body = await c.req.json<{ name?: string; ovr?: number; squadRating?: number }>();
    const day = new Date().toISOString().slice(0, 10);
    const { rank, top } = addDailyScore(day, {
      name: body.name ?? "Guest",
      ovr: body.ovr ?? 0,
      squadRating: body.squadRating,
      at: new Date().toISOString(),
    });
    return c.json({ ok: true, rank, leaderboard: top });
  });

  app.get("/api/sports/players/search", (c) => {
    const q = c.req.query("q") ?? "";
    const limit = Number(c.req.query("limit") ?? 30);
    return c.json({ results: searchPlayers(q, Math.min(limit, 50)), engine: "token-index-v2" });
  });

  app.get("/api/sports/players/:id/stats", (c) => {
    const id = c.req.param("id");
    const player = getDraftPlayers().find((p) => p.id === id);
    if (!player) return c.json({ error: "Not found" }, 404);
    return c.json({ player, stats: getSeasonStats(id) });
  });

  app.get("/api/sports/competitions", (c) => c.json(getCompetitions()));

  app.get("/api/sports/pool-counts", (c) => c.json({ ...poolCounts(), cache: poolCacheStats() }));

  app.post("/api/pool/preview", async (c) => {
    const body = await c.req.json<{ modeId?: string; minAppearances?: number; nationality?: string }>();
    const mode = getPresetMode(body.modeId ?? "all-time-any");
    const preview = previewPool(mode, {
      minAppearances: body.minAppearances,
      nationality: body.nationality,
    });
    return c.json({ mode, ...preview });
  });

  app.post("/api/ratings/compute-pool", async (c) => {
    const body = await c.req.json<{ modeId?: string }>().catch(() => ({ modeId: "all-time-any" }));
    const mode = getPresetMode(body.modeId ?? "all-time-any");
    const pool = buildDraftPool(mode);
    return c.json({
      mode,
      count: pool.length,
      top: pool.slice(0, 15),
      avgOvr: pool.length ? Math.round(pool.reduce((s, p) => s + p.ovr, 0) / pool.length) : 0,
      cache: poolCacheStats(),
    });
  });

  app.get("/api/players/:id/rating", (c) => {
    const id = c.req.param("id");
    const modeId = c.req.query("modeId") ?? "all-time-any";
    const player = getDraftPlayers().find((p) => p.id === id);
    if (!player) return c.json({ error: "Not found" }, 404);
    const mode = getPresetMode(modeId);
    const rated = computePlayerRating(
      {
        id: player.id,
        name: player.name,
        nationality: player.nationality,
        position: player.position,
        clubs: player.clubs,
        seasonStats: getSeasonStats(id),
      },
      mode,
    );
    return c.json(rated);
  });

  app.post("/api/draft/rooms", async (c) => {
    const body = await c.req.json<{
      modeId?: string;
      drafters?: number;
      squadSize?: number;
      format?: import("@sportverse/draftballer-types").DraftFormat;
    }>();
    const created = createRoomViaHttp(
      body.modeId ?? "all-time-any",
      body.drafters ?? 2,
      body.squadSize ?? 11,
      body.format ?? "snake",
    );
    return c.json(created, 201);
  });

  app.get("/api/draft/rooms/:code", (c) => {
    const fsm = getRoom(c.req.param("code").toUpperCase());
    if (!fsm) return c.json({ error: "Not found" }, 404);
    return c.json(fsm);
  });

  app.post("/api/draft/rooms/:code/start", (c) => {
    const code = c.req.param("code").toUpperCase();
    let fsm = getRoom(code);
    if (!fsm) return c.json({ error: "Not found" }, 404);
    fsm = advanceToPoolReady(fsm);
    fsm = startPicking(fsm);
    saveRoom(code, fsm);
    return c.json(fsm);
  });

  app.post("/api/draft/rooms/:code/pick", async (c) => {
    const code = c.req.param("code").toUpperCase();
    const body = await c.req.json<{ playerId: string; playerName: string; ovr: number; drafterIndex: number }>();
    const fsm = getRoom(code);
    if (!fsm) return c.json({ error: "Not found" }, 404);
    const { fsm: next, error } = serverApplyPick(
      fsm,
      body.playerId,
      body.drafterIndex,
      body.playerName,
      body.ovr,
    );
    if (error) return c.json({ error }, 400);
    saveRoom(code, next);
    persistRoom(code, next, Date.now() + 2 * 60 * 60 * 1000);
    return c.json(next);
  });

  app.post("/api/draft/rooms/:code/auction/nominate", async (c) => {
    const code = c.req.param("code").toUpperCase();
    const body = await c.req.json<{ playerId: string; nominatorIndex: number }>();
    const fsm = getRoom(code);
    if (!fsm) return c.json({ error: "Not found" }, 404);
    const pool = buildDraftPool(fsm.state.mode);
    const card = pool.find((p) => p.playerId === body.playerId);
    if (!card) return c.json({ error: "Unknown player" }, 400);
    const { fsm: next, error } = serverNominateAuction(fsm, card, body.nominatorIndex);
    if (error) return c.json({ error }, 400);
    saveRoom(code, next);
    persistRoom(code, next, Date.now() + 2 * 60 * 60 * 1000);
    return c.json(next);
  });

  app.post("/api/draft/rooms/:code/auction/bid", async (c) => {
    const code = c.req.param("code").toUpperCase();
    const body = await c.req.json<{ drafterIndex: number; amount: number }>();
    const fsm = getRoom(code);
    if (!fsm) return c.json({ error: "Not found" }, 404);
    const { fsm: next, error } = serverAuctionBid(fsm, body.drafterIndex, body.amount);
    if (error) return c.json({ error }, 400);
    saveRoom(code, next);
    persistRoom(code, next, Date.now() + 2 * 60 * 60 * 1000);
    return c.json(next);
  });

  app.post("/api/draft/rooms/:code/auction/resolve", (c) => {
    const code = c.req.param("code").toUpperCase();
    const fsm = getRoom(code);
    if (!fsm) return c.json({ error: "Not found" }, 404);
    const { fsm: next, error } = serverResolveAuction(fsm);
    if (error) return c.json({ error }, 400);
    saveRoom(code, next);
    persistRoom(code, next, Date.now() + 2 * 60 * 60 * 1000);
    return c.json(next);
  });

  app.post("/api/draft/rooms/:code/blind/pick", async (c) => {
    const code = c.req.param("code").toUpperCase();
    const body = await c.req.json<{ playerId: string; drafterIndex: number }>();
    const fsm = getRoom(code);
    if (!fsm) return c.json({ error: "Not found" }, 404);
    const pool = buildDraftPool(fsm.state.mode);
    const card = pool.find((p) => p.playerId === body.playerId);
    if (!card) return c.json({ error: "Unknown player" }, 400);
    const { fsm: next, error, ready } = serverBlindPick(fsm, body.drafterIndex, card);
    if (error) return c.json({ error }, 400);
    saveRoom(code, next);
    persistRoom(code, next, Date.now() + 2 * 60 * 60 * 1000);
    return c.json({ ...next, blindRoundReady: ready });
  });

  app.post("/api/draft/rooms/:code/blind/resolve", (c) => {
    const code = c.req.param("code").toUpperCase();
    const fsm = getRoom(code);
    if (!fsm) return c.json({ error: "Not found" }, 404);
    const { fsm: next, error } = serverResolveBlind(fsm);
    if (error) return c.json({ error }, 400);
    saveRoom(code, next);
    persistRoom(code, next, Date.now() + 2 * 60 * 60 * 1000);
    return c.json(next);
  });

  app.post("/api/squads/share", async (c) => {
    const body = await c.req.json();
    return c.json({ ok: true, stored: true, payload: body });
  });

  app.get("/api/formations", (c) => {
    return c.json({ formations: listAllFormationsWithCustom() });
  });

  app.post("/api/formations", async (c) => {
    const body = await c.req.json<{
      id?: string;
      name?: string;
      slots: import("@sportverse/draftballer-types").FormationDef["slots"];
      backLineCount?: number;
      widthCategory?: "narrow" | "balanced" | "wide";
      eraTags?: string[];
    }>();
    if (!body.slots?.length || body.slots.length !== 11) {
      return c.json({ error: "Custom formation requires exactly 11 slots" }, 400);
    }
    const formation = savePersistedCustomFormation({
      id: body.id ?? `custom_${crypto.randomUUID().slice(0, 8)}`,
      name: body.name ?? "Custom formation",
      backLineCount: body.backLineCount ?? 4,
      widthCategory: body.widthCategory ?? "balanced",
      eraTags: body.eraTags ?? [],
      slots: body.slots,
      isCustom: true,
    });
    return c.json(formation, 201);
  });

  app.post("/api/squads/:id/simulate", async (c) => {
    const body = await c.req.json<{
      opponentSquad?: SimSquadInputV2;
      simulationMode?: SimMatchConfig["simulationMode"];
      eraContext?: SimMatchConfig["eraContext"];
      tacticalIdentityHome?: SimMatchConfig["tacticalIdentityHome"];
      tacticalIdentityAway?: SimMatchConfig["tacticalIdentityAway"];
      weather?: SimMatchConfig["weather"];
      venue?: SimMatchConfig["venue"];
      formationHome?: string;
      formationAway?: string;
      allowMidmatchFormationChange?: boolean;
      squad?: SimSquadInputV2;
      seed?: string;
      matchday?: number;
    }>();

    const squad = body.squad;
    if (!squad?.players?.length || !body.opponentSquad?.players?.length) {
      return c.json({ error: "squad and opponentSquad with 11 players required in body" }, 400);
    }

    const config: SimMatchConfig = {
      ...DEFAULT_SIM_CONFIG,
      simulationMode: body.simulationMode ?? DEFAULT_SIM_CONFIG.simulationMode,
      eraContext: body.eraContext ?? DEFAULT_SIM_CONFIG.eraContext,
      tacticalIdentityHome: body.tacticalIdentityHome ?? DEFAULT_SIM_CONFIG.tacticalIdentityHome,
      tacticalIdentityAway: body.tacticalIdentityAway ?? DEFAULT_SIM_CONFIG.tacticalIdentityAway,
      weather: body.weather ?? DEFAULT_SIM_CONFIG.weather,
      venue: body.venue ?? DEFAULT_SIM_CONFIG.venue,
      formationHomeId: body.formationHome ?? squad.formationId ?? "4-4-2",
      formationAwayId: body.formationAway ?? body.opponentSquad.formationId ?? "4-4-2",
      allowMidmatchFormationChange: body.allowMidmatchFormationChange ?? true,
    };

    if (body.formationHome && !getFormationByIdPersisted(body.formationHome)) {
      return c.json({ error: "Unknown formationHome" }, 400);
    }
    if (body.formationAway && !getFormationByIdPersisted(body.formationAway)) {
      return c.json({ error: "Unknown formationAway" }, 400);
    }

    const seed = body.seed ?? `api_${c.req.param("id")}_${Date.now()}`;
    const result = simulateMatchV2(squad, body.opponentSquad, seed, body.matchday ?? 1, { config });
    return c.json({
      squadId: c.req.param("id"),
      ...result,
      fit_report: result.fitReport,
      zone_overload_events: result.zoneOverloadEvents,
    });
  });

  app.post("/api/squads/:id/simulate-era-lab", async (c) => {
    const body = await c.req.json<{
      squad?: SimSquadInputV2;
      config?: Partial<SimMatchConfig>;
      seed?: string;
      opponentFactory?: SimSquadInputV2;
    }>();

    if (!body.squad?.players?.length) {
      return c.json({ error: "squad with players required in body" }, 400);
    }

    const seed = body.seed ?? `eralab_${c.req.param("id")}_${Date.now()}`;
    const oppTemplate =
      body.opponentFactory ??
      ({
        name: "Rival XI",
        playerIds: body.squad.playerIds,
        players: body.squad.players.map((p) => ({ ...p, ovr: Math.max(50, p.ovr - 4) })),
        squadOvr: Math.max(50, body.squad.squadOvr - 4),
      } satisfies SimSquadInputV2);

    const result = simulateEraLab(body.squad, seed, body.config ?? {}, () => oppTemplate);

    return c.json({
      squadId: c.req.param("id"),
      ...result,
      era_lab_batch: result.rows,
    });
  });

  return app;
}

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolvePort) => {
    const probe = createServer();
    probe.once("error", () => resolvePort(false));
    probe.once("listening", () => {
      probe.close(() => resolvePort(true));
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

function bootstrapSportsDb() {
  const dataDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../../packages/sports-db/data");
  const readOptional = (file: string) => {
    try {
      return JSON.parse(readFileSync(resolve(dataDir, file), "utf8"));
    } catch {
      return [];
    }
  };
  __setExtendedDataForTests({
    players: JSON.parse(readFileSync(resolve(dataDir, "players-extended.json"), "utf8")),
    stats: JSON.parse(readFileSync(resolve(dataDir, "season-stats.json"), "utf8")),
    competitions: JSON.parse(readFileSync(resolve(dataDir, "competitions.json"), "utf8")),
    clubs: JSON.parse(readFileSync(resolve(dataDir, "clubs-extended.json"), "utf8")),
    eras: JSON.parse(readFileSync(resolve(dataDir, "era-baselines.json"), "utf8")),
    aliases: readOptional("player-aliases.json"),
    awards: readOptional("awards.json"),
    moments: readOptional("iconic_moments.json"),
    leagueStrengthIndex: readOptional("league-strength-index.json"),
    confederationStrengthIndex: readOptional("confederation-strength-index.json"),
    crossLeagueFixtures: readOptional("cross-league-fixtures.json"),
    playerTransfers: readOptional("player-transfers.json"),
  });
  setAwardsData(getAwards(), getIconicMoments());
  try {
    setCalibrationData(JSON.parse(readFileSync(resolve(dataDir, "player-calibration.json"), "utf8")));
  } catch {
    setCalibrationData([]);
  }
}

export async function startServer() {
  const config = loadConfig();
  bootstrapSportsDb();
  reloadPersistedRooms();
  const store = new PlayerStore(config.databasePath);
  const app = createApp(store);
  const port = await resolvePort(config.port);
  const server = createServer();

  serve({ fetch: app.fetch, port, server });

  try {
    attachDraftSocket(server);
  } catch (err) {
    console.warn("Socket.IO attach skipped:", err);
  }

  if (port !== config.port) {
    console.warn(`Port ${config.port} in use. Using http://localhost:${port}`);
  }

  return { app, port, server };
}
