import { platform, ACHIEVEMENTS } from "@sportverse/platform";
import { IndexDeck } from "@sportverse/quiz-engine";
import { getGoalkeeperPool, poolCount } from "@sportverse/sports-db";
import {
  predictFromCues,
  resolveSave,
  type DiveDirection,
  type GoalkeeperLevel,
} from "@sportverse/sim-core";

type Navigate = (route: "hub" | "quiz" | "football-iq" | "goalkeeper", param?: string) => void;

export function renderGoalkeeper(root: HTMLElement, navigate: Navigate) {
  const pool = getGoalkeeperPool();
  const deck = new IndexDeck(pool.length);
  let saves = 0;

  function showLevel(level: GoalkeeperLevel) {
    const preds = predictFromCues(level.cues);
    const cueLabels = {
      footAngle: `Foot angle: ${level.cues.footAngle}`,
      shoulderOpen: `Shoulders: ${level.cues.shoulderOpen ? "open" : "closed"}`,
      eyesLook: `Eyes: ${level.cues.eyesLook}`,
      runSpeed: `Approach: ${level.cues.runSpeed}`,
      fakes: level.cues.fakes ? "Body fake detected" : "No fake",
    };

    root.innerHTML = `
      <div class="shell">
        <div class="game-head">
          <button class="btn btn--ghost" id="back">← Hub</button>
          <h1>Goalkeeper Instinct</h1>
          <p class="muted">Level ${deck.round + 1} / ${poolCount()}</p>
        </div>
        <div class="panel">
          <p><strong>${level.title}</strong></p>
          <p>${level.description}</p>
        </div>
        <div class="goal-box"><div class="striker">⚽</div></div>
        <div class="cues">
          ${Object.values(cueLabels).map((c) => `<div class="cue">${c}</div>`).join("")}
        </div>
        <p style="font-size:12px;color:var(--muted)">Read the striker — dive before the shot.</p>
        <div class="options">
          <button class="btn btn--block" data-d="left">Dive left</button>
          <button class="btn btn--block" data-d="center">Stay center</button>
          <button class="btn btn--block" data-d="right">Dive right</button>
        </div>
        <div id="out"></div>
      </div>`;

    root.querySelector("#back")?.addEventListener("click", () => navigate("hub"));

    root.querySelectorAll("[data-d]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const guess = (btn as HTMLElement).dataset.d as DiveDirection;
        const result = resolveSave(level, guess);
        if (result.saved) saves++;

        platform.grantReward({
          xp: result.xpEarned,
          coins: result.saved ? 5 : 1,
          achievementId: saves >= 5 ? ACHIEVEMENTS.SHOT_STOPPER.id : undefined,
        });

        const p = platform.getProfile();
        platform.saveLocal({
          ...p,
          stats: { ...p.stats, goalkeeperSaves: p.stats.goalkeeperSaves + (result.saved ? 1 : 0) },
        });

        const out = root.querySelector("#out")!;
        out.innerHTML = `
          <div class="result ${result.saved ? "" : "result--bad"}">
            <strong>${result.saved ? "SAVED!" : "Goal…"}</strong> Shot went ${result.actual}.
            <p>${result.explanation}</p>
            <p>Read accuracy on true direction: ${result.readAccuracy}% · +${result.xpEarned} XP</p>
            <button class="btn" id="next">${deck.hasMore ? "Next level" : "Finish session"}</button>
          </div>`;

        root.querySelector("#next")?.addEventListener("click", () => {
          const idx = deck.next();
          if (idx !== undefined) showLevel(pool[idx]!);
          else {
            root.innerHTML = `<div class="shell"><div class="result"><strong>All ${poolCount()} levels complete!</strong><p>${saves} saves this session.</p><button class="btn" id="hub">Hub</button></div></div>`;
            root.querySelector("#hub")?.addEventListener("click", () => navigate("hub"));
          }
        });
      });
    });
  }

  const first = deck.next();
  if (first !== undefined) showLevel(pool[first]!);
}
