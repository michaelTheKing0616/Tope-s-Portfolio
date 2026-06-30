import { platform, ACHIEVEMENTS } from "@sportverse/platform";
import { IndexDeck } from "@sportverse/quiz-engine";
import { getFootballIQPool, poolCount } from "@sportverse/sports-db";
import { resolveDecision, type DecisionId, type FootballIQScenario } from "@sportverse/sim-core";

type Navigate = (route: "hub" | "quiz" | "football-iq" | "goalkeeper", param?: string) => void;

export function renderFootballIQ(root: HTMLElement, navigate: Navigate) {
  const pool = getFootballIQPool();
  const deck = new IndexDeck(pool.length);
  let optimalCount = 0;
  let timer: ReturnType<typeof setInterval> | undefined;

  function showScenario(scenario: FootballIQScenario) {
    let timeLeft = scenario.timeLimitSec;
    clearInterval(timer);

    root.innerHTML = `
      <div class="shell">
        <div class="game-head">
          <button class="btn btn--ghost" id="back">← Hub</button>
          <h1>Football IQ</h1>
          <p class="muted">Round ${deck.round + 1} / ${poolCount()}</p>
        </div>
        <div class="panel">
          <p><strong>${scenario.title}</strong> · ${scenario.minute}' · ${scenario.difficulty}</p>
          <p>${scenario.context}</p>
        </div>
        <div class="timer" id="clock">${timeLeft}s</div>
        <div class="options" id="opts"></div>
        <div id="out"></div>
      </div>`;

    root.querySelector("#back")?.addEventListener("click", () => {
      clearInterval(timer);
      navigate("hub");
    });

    const opts = root.querySelector("#opts")!;
    scenario.options.forEach((opt) => {
      const btn = document.createElement("button");
      btn.className = "btn btn--block btn--ghost";
      btn.textContent = opt.label;
      btn.addEventListener("click", () => choose(scenario, opt.id));
      opts.appendChild(btn);
    });

    timer = setInterval(() => {
      timeLeft -= 1;
      const clock = root.querySelector("#clock");
      if (clock) clock.textContent = `${timeLeft}s`;
      if (timeLeft <= 0) {
        clearInterval(timer);
        choose(scenario, scenario.options[0]!.id, true);
      }
    }, 1000);
  }

  function choose(scenario: FootballIQScenario, choice: DecisionId, timeout = false) {
    clearInterval(timer);
    const result = resolveDecision(scenario, choice);
    if (result.wasOptimal) optimalCount++;

    platform.grantReward({
      xp: result.xpEarned,
      coins: Math.floor(result.xpEarned / 5),
      achievementId: result.wasOptimal && optimalCount >= 3 ? ACHIEVEMENTS.TACTICIAN.id : undefined,
    });

    const p = platform.getProfile();
    platform.saveLocal({
      ...p,
      stats: { ...p.stats, footballIqCorrect: p.stats.footballIqCorrect + (result.wasOptimal ? 1 : 0) },
    });

    const out = root.querySelector("#out")!;
    out.innerHTML = `
      <div class="result ${result.wasOptimal ? "" : "result--bad"}">
        <strong>${timeout ? "Time's up — " : ""}${result.outcome}</strong>
        <p>${result.explanation}</p>
        <p>+${result.xpEarned} XP ${result.wasOptimal ? "· Optimal!" : ""}</p>
        <button class="btn" id="next">${deck.hasMore ? "Next scenario" : "Finish session"}</button>
      </div>`;

    root.querySelector("#next")?.addEventListener("click", () => {
      const idx = deck.next();
      if (idx !== undefined) showScenario(pool[idx]!);
      else {
        root.innerHTML = `<div class="shell"><div class="result"><strong>Session complete</strong><p>${optimalCount}/${deck.total} optimal decisions across ${poolCount()} scenarios.</p><button class="btn" id="hub">Hub</button></div></div>`;
        root.querySelector("#hub")?.addEventListener("click", () => navigate("hub"));
      }
    });
  }

  const first = deck.next();
  if (first !== undefined) showScenario(pool[first]!);
}
