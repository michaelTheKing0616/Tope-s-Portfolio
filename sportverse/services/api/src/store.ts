import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  applyReward,
  createGuestProfile,
  type LeaderboardEntry,
  type PlayerProfile,
  type RewardGrant,
  updateStreak,
  xpToLevel,
} from "@sportverse/platform";

interface Database {
  players: Record<string, PlayerProfile>;
}

export function loadConfig() {
  return {
    port: Number(process.env.PORT ?? 8792),
    databasePath: resolve(process.env.SPORTVERSE_DATABASE_PATH ?? "./data/sportverse.json"),
  };
}

export class PlayerStore {
  private data: Database;
  private readonly path: string;

  constructor(path: string) {
    this.path = path;
    mkdirSync(dirname(path), { recursive: true });
    if (existsSync(path)) {
      this.data = JSON.parse(readFileSync(path, "utf8")) as Database;
    } else {
      this.data = { players: {} };
      this.flush();
    }
  }

  private flush(): void {
    const tmp = `${this.path}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.data, null, 2), "utf8");
    renameSync(tmp, this.path);
  }

  get(id: string): PlayerProfile | undefined {
    return this.data.players[id];
  }

  save(profile: PlayerProfile): PlayerProfile {
    const normalized = { ...profile, level: xpToLevel(profile.xp) };
    this.data.players[profile.id] = normalized;
    this.flush();
    return normalized;
  }

  getOrCreate(id: string, displayName?: string): PlayerProfile {
    const existing = this.get(id);
    if (existing) return existing;
    const guest = createGuestProfile(displayName ?? "Legend");
    guest.id = id;
    guest.isGuest = id.startsWith("guest_");
    return this.save(guest);
  }

  grant(id: string, reward: RewardGrant): PlayerProfile {
    let p = this.getOrCreate(id);
    p = updateStreak(p);
    p = applyReward(p, reward);
    return this.save(p);
  }

  leaderboard(limit = 20): LeaderboardEntry[] {
    return Object.values(this.data.players)
      .sort((a, b) => b.xp - a.xp)
      .slice(0, limit)
      .map((p) => ({ playerId: p.id, displayName: p.displayName, xp: p.xp, level: p.level }));
  }
}
