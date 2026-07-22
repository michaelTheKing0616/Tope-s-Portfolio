import {
  getPresetMode,
  loadHubProgress,
  loadSquadForSeason,
  recordDailyPlay,
  resolveDailyChallenge,
} from "@sportverse/draftballer-core";
import { platform, resolveApiBase } from "@sportverse/platform";
import { bindEliteMotion } from "../lib/elite-motion.js";
import { keepieLoaderHtml } from "../lib/keepie-loader.js";

type Navigate = (route: string, param?: string) => void;

const API_BASE = resolveApiBase();

export interface DailyLeaderboardEntry {
  name: string;
  ovr: number;
  at: string;
}

export interface DailyChallengeResponse {
  modeId: string;
  mode: string;
  seed: string;
  bonusXp: number;
  leaderboard: DailyLeaderboardEntry[];
}

export function getDailyChallengeMode() {
  return resolveDailyChallenge();
}

/** GET /api/daily — today's challenge + leaderboard. */
export async function fetchDailyBoard(): Promise<DailyChallengeResponse | null> {
  if (!API_BASE) return null;
  try {
    const res = await fetch(`${API_BASE}/api/daily`);
    if (!res.ok) return null;
    return (await res.json()) as DailyChallengeResponse;
  } catch {
    return null;
  }
}

/**
 * POST /api/daily/score — submit squad OVR after completing today's wheel draft.
 * Body: `{ name: string, ovr: number }` → `{ ok: true, rank: number }`
 */
export async function submitDailyScore(name: string, ovr: number): Promise<{ ok: boolean; rank?: number }> {
  if (!API_BASE) return { ok: false };
  try {
    const res = await fetch(`${API_BASE}/api/daily/score`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, ovr }),
    });
    if (!res.ok) return { ok: false };
    return (await res.json()) as { ok: boolean; rank: number };
  } catch {
    return { ok: false };
  }
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function estimateXpYield(rank: number, ovr: number, topOvr: number, bonusXp: number): number {
  if (rank === 1) return bonusXp;
  const ovrRatio = topOvr > 0 ? ovr / topOvr : 0.5;
  const rankDecay = Math.max(0.15, 1 - (rank - 1) * 0.12);
  return Math.max(50, Math.round(bonusXp * ovrRatio * rankDecay));
}

function msUntilMidnightUtc(): number {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return next.getTime() - now.getTime();
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function leaderboardTableHtml(entries: DailyLeaderboardEntry[], bonusXp: number): string {
  if (!entries.length) {
    return `<p class="db-daily-empty">No scores yet — be first after your draft.</p>`;
  }
  const topOvr = entries[0]?.ovr ?? 90;
  return `
    <table class="db-daily-table">
      <thead>
        <tr>
          <th>Rank</th>
          <th>Player Profile</th>
          <th>OVR</th>
          <th>XP Yield</th>
        </tr>
      </thead>
      <tbody>
        ${entries
          .slice(0, 20)
          .map((e, i) => {
            const rank = i + 1;
            const xp = estimateXpYield(rank, e.ovr, topOvr, bonusXp);
            return `<tr>
              <td><span class="db-daily-table__rank${rank === 1 ? " db-daily-table__rank--top" : ""}">${String(rank).padStart(2, "0")}</span></td>
              <td>
                <div class="db-daily-profile">
                  <span class="db-daily-profile__chip">${initialsFromName(e.name)}</span>
                  <span class="db-daily-profile__name">${e.name}</span>
                </div>
              </td>
              <td class="db-daily-table__ovr">${e.ovr}</td>
              <td class="db-daily-table__xp">+${xp.toLocaleString()}</td>
            </tr>`;
          })
          .join("")}
      </tbody>
    </table>`;
}

function dailyStatsHtml(data: DailyChallengeResponse | null, leaderboardLen: number): string {
  const bonusXp = data?.bonusXp ?? 500;
  const activeUsers = leaderboardLen > 0 ? leaderboardLen.toLocaleString() : "—";
  return `
    <div class="db-daily-stat db-glass">
      <span class="db-daily-stat__label db-label-caps">Ends In</span>
      <span class="db-daily-stat__value" id="daily-countdown">${formatCountdown(msUntilMidnightUtc())}</span>
    </div>
    <div class="db-daily-stat db-glass">
      <span class="db-daily-stat__label db-label-caps">Active Users</span>
      <span class="db-daily-stat__value">${activeUsers}</span>
    </div>
    <div class="db-daily-stat db-glass">
      <span class="db-daily-stat__label db-label-caps">Prize Pool</span>
      <span class="db-daily-stat__value db-daily-stat__value--pitch">${bonusXp.toLocaleString()} XP</span>
    </div>
    <div class="db-daily-stat db-glass">
      <span class="db-daily-stat__label db-label-caps">Region</span>
      <span class="db-daily-stat__value">GLOBAL</span>
    </div>`;
}

export async function renderDraftballerDaily(root: HTMLElement, navigate: Navigate) {
  const apiDaily = await fetchDailyBoard();
  const offline = getDailyChallengeMode();
  const day = apiDaily?.seed ?? offline.day;
  const mode = apiDaily ? getPresetMode(apiDaily.modeId) : offline.mode;
  const profile = platform.getProfile();
  const saved = loadSquadForSeason();
  const isDailySquad = saved?.mode.id === `daily-${day}`;
  const progress = loadHubProgress();
  const playedToday = progress.lastDailyDay === day;
  const bestOvr = isDailySquad ? saved!.squadOvr : null;
  const bonusXp = apiDaily?.bonusXp ?? 500;
  const leaderboard = apiDaily?.leaderboard ?? [];

  let countdownTimer: ReturnType<typeof setInterval> | null = null;

  function paintLeaderboard(entries: DailyLeaderboardEntry[]) {
    const panel = root.querySelector("#leaderboard-panel");
    if (!panel) return;
    panel.innerHTML = `
      <div class="db-daily-board__head">
        <h3 class="db-label-caps">Global Leaderboard</h3>
        <span class="db-daily-board__live db-soft-pulse">LIVE</span>
      </div>
      <div class="db-daily-board__body">${leaderboardTableHtml(entries, bonusXp)}</div>`;

    const stats = root.querySelector("#daily-stats");
    if (stats) stats.innerHTML = dailyStatsHtml(apiDaily, entries.length);
  }

  root.innerHTML = `
    <div class="shell db-root db-daily-page">
      <button class="btn btn--ghost" id="back">← Hub</button>

      <section class="db-daily-hero">
        <div class="db-daily-live-pill db-soft-pulse">
          <span class="db-daily-live-pill__dot" aria-hidden="true"></span>
          <span class="db-label-caps">Daily Challenge Live</span>
        </div>
        <h1 class="db-daily-hero__title">Daily Draft: <span class="db-daily-hero__mode db-soft-pulse db-text-glow">${mode.title}</span></h1>
        <p class="db-daily-hero__sub">Shared challenge for ${day} — same pool for everyone.</p>
      </section>

      <div class="db-daily-grid">
        <div class="db-daily-board db-glass" id="leaderboard-panel">
          <div class="db-daily-board__head">
            <h3 class="db-label-caps">Global Leaderboard</h3>
            <span class="db-daily-board__live db-soft-pulse">LIVE</span>
          </div>
          <div class="db-daily-board__body">${keepieLoaderHtml({ size: 48, label: "Loading", className: "db-keepie--inline" })}</div>
        </div>

        <aside class="db-daily-aside">
          <div class="db-daily-cta db-glass">
            <p class="db-label-caps db-daily-cta__label">Ready to Draft?</p>
            <p class="db-daily-cta__hint">Build your XI from today's wheel pool, then submit your squad OVR.</p>
            <button class="db-btn-pitch db-daily-cta__btn" id="start">Start Today's Wheel Draft</button>
            ${
              isDailySquad
                ? `<div class="db-daily-submit">
                    <p class="db-daily-submit__ovr">Squad OVR <strong>${saved!.squadOvr}</strong></p>
                    <button class="db-btn-pitch db-daily-submit__btn" id="submit">Submit Score</button>
                    <p class="db-daily-submit__status" id="submit-status"></p>
                  </div>`
                : ""
            }
          </div>

          <div class="db-daily-progress db-glass">
            <h4 class="db-label-caps db-daily-progress__title">Progress Metrics</h4>
            <div class="db-daily-progress__row">
              <span class="db-daily-progress__label">Daily Attempts</span>
              <span class="db-daily-progress__value">${playedToday ? "01" : "00"} / 01</span>
            </div>
            <div class="db-daily-progress__bar" aria-hidden="true">
              <div class="db-daily-progress__fill" style="width:${playedToday ? "100" : "0"}%"></div>
            </div>
            <div class="db-daily-progress__row db-daily-progress__row--border">
              <span class="db-daily-progress__label">Best Today</span>
              <span class="db-daily-progress__value">${bestOvr ?? "—"}${bestOvr ? " OVR" : ""}</span>
            </div>
          </div>
        </aside>
      </div>

      <div class="db-daily-stats" id="daily-stats">${dailyStatsHtml(apiDaily, leaderboard.length)}</div>

      <p class="db-daily-footer">Scores sync via <code>GET /api/daily</code> · submit after wheel draft</p>
    </div>`;

  root.querySelector("#back")?.addEventListener("click", () => {
    if (countdownTimer) clearInterval(countdownTimer);
    navigate("draftballer");
  });

  root.querySelector("#start")?.addEventListener("click", () => {
    recordDailyPlay(day);
    sessionStorage.setItem("db_mode", JSON.stringify({ ...mode, id: `daily-${day}` }));
    navigate("draftballer", "wheel");
  });

  root.querySelector("#submit")?.addEventListener("click", async () => {
    if (!saved) return;
    const statusEl = root.querySelector("#submit-status");
    if (statusEl) {
      statusEl.innerHTML = keepieLoaderHtml({ size: 48, label: "Submitting", className: "db-keepie--inline" });
    }
    const result = await submitDailyScore(profile.displayName, saved.squadOvr);
    if (result.ok) {
      if (statusEl) statusEl.textContent = `Submitted — rank #${result.rank ?? "?"}`;
      void refreshLeaderboard();
    } else if (statusEl) {
      statusEl.textContent = "Submit failed — API offline?";
    }
  });

  countdownTimer = setInterval(() => {
    const el = root.querySelector("#daily-countdown");
    if (el) el.textContent = formatCountdown(msUntilMidnightUtc());
  }, 1000);

  async function refreshLeaderboard() {
    const data = await fetchDailyBoard();
    paintLeaderboard(data?.leaderboard ?? []);
  }

  paintLeaderboard(leaderboard);

  const pageRoot = root.querySelector(".db-root") as HTMLElement | null;
  if (pageRoot) bindEliteMotion(pageRoot, { scan: "line" });
}
