import {
  applyReward,
  createGuestProfile,
  type LeaderboardEntry,
  type PlayerProfile,
  type RewardGrant,
  updateStreak,
} from "./types.js";

export * from "./types.js";

const API_BASE = typeof window !== "undefined"
  ? (import.meta.env?.VITE_API_URL as string | undefined) ?? "http://localhost:8792"
  : "http://localhost:8792";

const STORAGE_KEY = "sportverse_profile";
const FETCH_TIMEOUT_MS = 2_500;

async function fetchWithTimeout(input: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export class PlatformClient {
  private profile: PlayerProfile | null = null;

  constructor(private readonly baseUrl = API_BASE) {}

  loadLocal(): PlayerProfile | null {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      this.profile = JSON.parse(raw) as PlayerProfile;
      return this.profile;
    } catch {
      return null;
    }
  }

  saveLocal(profile: PlayerProfile): void {
    this.profile = profile;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    }
  }

  getProfile(): PlayerProfile {
    if (!this.profile) {
      this.profile = this.loadLocal() ?? createGuestProfile();
      this.saveLocal(this.profile);
    }
    return this.profile;
  }

  async syncProfile(): Promise<PlayerProfile> {
    const p = this.getProfile();
    try {
      const res = await fetchWithTimeout(`${this.baseUrl}/api/players/${p.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(p),
      });
      if (res.ok) {
        const updated = (await res.json()) as PlayerProfile;
        this.saveLocal(updated);
        return updated;
      }
    } catch {
      /* offline — local only */
    }
    return p;
  }

  grantReward(reward: RewardGrant): PlayerProfile {
    let p = updateStreak(this.getProfile());
    p = applyReward(p, reward);
    p = { ...p, stats: { ...p.stats, gamesPlayed: p.stats.gamesPlayed + 1 } };
    this.saveLocal(p);
    void this.syncProfile();
    return p;
  }

  async fetchLeaderboard(): Promise<LeaderboardEntry[]> {
    try {
      const res = await fetchWithTimeout(`${this.baseUrl}/api/leaderboard`);
      if (res.ok) return (await res.json()) as LeaderboardEntry[];
    } catch {
      /* ignore */
    }
    const p = this.getProfile();
    return [{ playerId: p.id, displayName: p.displayName, xp: p.xp, level: p.level }];
  }

  async getDailyChallenge(): Promise<{ mode: string; seed: string; bonusXp: number }> {
    try {
      const res = await fetchWithTimeout(`${this.baseUrl}/api/daily`);
      if (res.ok) return (await res.json()) as { mode: string; seed: string; bonusXp: number };
    } catch {
      /* ignore */
    }
    const modes = ["who-am-i", "speed-round", "true-false", "guess-club", "career-path"];
    const day = new Date().toISOString().slice(0, 10);
    const idx = day.split("-").reduce((a, b) => a + Number(b), 0) % modes.length;
    return { mode: modes[idx]!, seed: day, bonusXp: 50 };
  }
}

export const platform = new PlatformClient();
