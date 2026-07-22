import { platform } from "@sportverse/platform";
import { QUIZ_MODES } from "@sportverse/quiz-engine";
import type { LeaderboardEntry } from "@sportverse/platform";
import { keepieLoaderHtml } from "../lib/keepie-loader.js";

type Navigate = (route: string, param?: string) => void;

function hubHtml(
  profile: ReturnType<typeof platform.getProfile>,
  daily: { mode: string; bonusXp: number },
  board: LeaderboardEntry[],
  loading = false,
) {
  return `
    <div class="shell">
      <header class="hero">
        <p class="hero__label">SPORTVERSE</p>
        <h1 class="hero__title">BECOME A<br/>SPORTS LEGEND</h1>
        <p class="hero__sub">One account. One XP. One universe. Learn → Play → Improve → Compete → Collect → Return daily.</p>
      </header>

      <div class="stats">
        <div class="stat"><div class="stat__val">Lv ${profile.level}</div><div class="stat__lbl">Level</div></div>
        <div class="stat"><div class="stat__val">${profile.xp}</div><div class="stat__lbl">XP</div></div>
        <div class="stat"><div class="stat__val">${profile.coins}</div><div class="stat__lbl">Coins</div></div>
        <div class="stat"><div class="stat__val">${profile.streak}🔥</div><div class="stat__lbl">Streak</div></div>
      </div>

      <div class="panel">
        <strong>Daily Challenge</strong>
        <p>Today: <em>${loading ? "Loading…" : daily.mode.replace(/-/g, " ")}</em> — bonus +${daily.bonusXp} XP</p>
        <button class="btn" id="daily-btn" ${loading ? "disabled" : ""}>Play daily</button>
      </div>

      <h2 style="font-family:var(--font-display);letter-spacing:.08em;font-size:1.4rem;margin:24px 0 12px">SKILL GAMES</h2>
      <div class="grid">
        <a class="card" href="#/football-iq" data-route="football-iq">
          <span class="card__tag">Tactical</span>
          <h3 class="card__title">Football IQ</h3>
          <p class="card__blurb">Chess meets Football Manager. 4-second tactical decisions.</p>
        </a>
        <a class="card" href="#/goalkeeper" data-route="goalkeeper">
          <span class="card__tag">Reaction</span>
          <h3 class="card__title">Goalkeeper Instinct</h3>
          <p class="card__blurb">Read body language. Dive before the shot.</p>
        </a>
        <a class="card" href="#/draftballer" data-route="draftballer">
          <span class="card__tag">Draft · New</span>
          <h3 class="card__title">DRAFTBALLER</h3>
          <p class="card__blurb">Draft the greatest XI — any era, OVR-rated player cards, snake draft vs bot.</p>
        </a>
      </div>

      <h2 style="font-family:var(--font-display);letter-spacing:.08em;font-size:1.4rem;margin:24px 0 12px">SPORTS IQ</h2>
      <div class="grid">
        ${QUIZ_MODES.map(
          (m) => `
          <a class="card" href="#/quiz/${m.id}" data-quiz="${m.id}">
            <span class="card__tag">Quiz</span>
            <h3 class="card__title">${m.title}</h3>
            <p class="card__blurb">${m.blurb}</p>
          </a>`,
        ).join("")}
      </div>

      <h2 style="font-family:var(--font-display);letter-spacing:.08em;font-size:1.4rem;margin:24px 0 12px">LEADERBOARD</h2>
      <div class="panel">
        ${
          loading
            ? keepieLoaderHtml({ size: 48, label: "Loading", className: "db-keepie--inline" })
            : `<ul class="leaderboard">
                ${board.map((e, i) => `<li><span>#${i + 1} ${e.displayName}</span><span>${e.xp} XP · Lv ${e.level}</span></li>`).join("")}
              </ul>`
        }
      </div>

      ${
        profile.achievements.length
          ? `<p style="color:var(--muted);font-size:13px">Achievements: ${profile.achievements.join(", ")}</p>`
          : ""
      }
    </div>
  `;
}

function bindHub(root: HTMLElement, navigate: Navigate) {
  root.querySelector("#daily-btn")?.addEventListener("click", () => navigate("draftballer", "daily"));
}

export async function renderHub(root: HTMLElement, navigate: Navigate) {
  const profile = platform.getProfile();
  const fallbackDaily = { mode: "all-time-any", bonusXp: 50 };

  root.innerHTML = hubHtml(profile, fallbackDaily, [], true);
  bindHub(root, navigate);

  try {
    const [daily, board] = await Promise.all([platform.getDailyChallenge(), platform.fetchLeaderboard()]);
    root.innerHTML = hubHtml(profile, daily, board);
    bindHub(root, navigate);
  } catch {
    const board = await platform.fetchLeaderboard();
    root.innerHTML = hubHtml(profile, fallbackDaily, board);
    bindHub(root, navigate);
  }
}
