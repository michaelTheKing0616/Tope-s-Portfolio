import { getPresetMode, loadSquadForSeason } from "@sportverse/draftballer-core";
import { platform } from "@sportverse/platform";

type Navigate = (route: string, param?: string) => void;

const API_BASE = (import.meta.env?.VITE_API_URL as string | undefined) ?? "http://localhost:8792";

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
  const day = new Date().toISOString().slice(0, 10);
  const modes = ["all-time-any", "premier-league", "international", "decade-2010s", "club-only"];
  const idx = day.split("-").reduce((a, b) => a + Number(b), 0) % modes.length;
  const modeId = modes[idx]!;
  return { day, mode: getPresetMode(modeId), modeId };
}

/** GET /api/daily — today's challenge + leaderboard. */
export async function fetchDailyBoard(): Promise<DailyChallengeResponse | null> {
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

function leaderboardHtml(entries: DailyLeaderboardEntry[]): string {
  if (!entries.length) {
    return `<p style="color:var(--db-muted);font-size:0.85rem">No scores yet — be first after your draft.</p>`;
  }
  return `
    <ol class="db-daily-leaderboard">
      ${entries
        .slice(0, 20)
        .map(
          (e, i) =>
            `<li><span class="db-daily-rank">${i + 1}</span><strong>${e.name}</strong><span class="db-daily-ovr">${e.ovr} OVR</span></li>`,
        )
        .join("")}
    </ol>`;
}

export function renderDraftballerDaily(root: HTMLElement, navigate: Navigate) {
  const { day, mode } = getDailyChallengeMode();
  const profile = platform.getProfile();
  const saved = loadSquadForSeason();
  const isDailySquad = saved?.mode.id === `daily-${day}`;

  root.innerHTML = `
    <div class="shell db-root">
      <button class="btn btn--ghost" id="back">← Hub</button>
      <header class="db-hero">
        <p class="db-hero__label">Daily Draft Challenge</p>
        <h1 class="db-hero__title">${mode.title}</h1>
        <p style="color:var(--db-muted)">Shared challenge for ${day} — same pool for everyone.</p>
      </header>

      <div class="panel" id="leaderboard-panel">
        <p class="db-hero__label">Today's leaderboard</p>
        <p style="color:var(--db-muted);font-size:0.85rem">Loading…</p>
      </div>

      <button class="btn" id="start">Start today's wheel draft</button>

      ${
        isDailySquad
          ? `<div class="panel" style="margin-top:12px">
              <p class="db-hero__label">Submit your score</p>
              <p style="color:var(--db-muted);font-size:0.85rem">Squad OVR <strong style="color:var(--db-gold)">${saved!.squadOvr}</strong> — submit after draft completes.</p>
              <button class="btn" id="submit" style="width:100%;margin-top:8px">POST score to leaderboard</button>
              <p id="submit-status" style="font-size:0.8rem;color:var(--db-muted);margin-top:8px"></p>
            </div>`
          : ""
      }

      <div class="panel db-daily-api-doc" style="margin-top:12px;font-size:0.8rem;color:var(--db-muted)">
        <strong style="color:var(--db-gold)">API usage</strong>
        <ul class="db-stat-list">
          <li><code>GET /api/daily</code> — mode, seed, bonusXp, leaderboard[]</li>
          <li><code>POST /api/daily/score</code> — body <code>{ name, ovr }</code> after wheel draft; returns rank</li>
        </ul>
        <p style="margin-top:8px">Wheel completion hook lives in draftballer-wheel — return here to submit your squad OVR.</p>
      </div>
    </div>`;

  root.querySelector("#back")?.addEventListener("click", () => navigate("draftballer"));
  root.querySelector("#start")?.addEventListener("click", () => {
    sessionStorage.setItem("db_mode", JSON.stringify({ ...mode, id: `daily-${day}` }));
    navigate("draftballer", "wheel");
  });

  root.querySelector("#submit")?.addEventListener("click", async () => {
    if (!saved) return;
    const statusEl = root.querySelector("#submit-status");
    if (statusEl) statusEl.textContent = "Submitting…";
    const result = await submitDailyScore(profile.displayName, saved.squadOvr);
    if (result.ok) {
      if (statusEl) statusEl.textContent = `Submitted — rank #${result.rank ?? "?"}`;
      void refreshLeaderboard();
    } else if (statusEl) {
      statusEl.textContent = "Submit failed — API offline?";
    }
  });

  async function refreshLeaderboard() {
    const panel = root.querySelector("#leaderboard-panel");
    if (!panel) return;
    const data = await fetchDailyBoard();
    panel.innerHTML = `
      <p class="db-hero__label">Today's leaderboard</p>
      ${leaderboardHtml(data?.leaderboard ?? [])}`;
  }

  void refreshLeaderboard();
}
