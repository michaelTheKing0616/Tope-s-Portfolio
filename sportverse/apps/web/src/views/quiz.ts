import { platform, ACHIEVEMENTS } from "@sportverse/platform";
import {
  QUIZ_MODES,
  answerGuessClub,
  answerSpeedQuestion,
  answerTrueFalse,
  answerWhoAmI,
  contentPoolSize,
  createCareerPathDeck,
  createGuessClubDeck,
  createSpeedQuestionDeck,
  createTrueFalseDeck,
  createWhoAmIDeck,
  finalizeSpeedRound,
  revealNextClue,
  startSpeedRound,
  startWhoAmI,
  submitCareerPath,
  type IdDeck,
} from "@sportverse/quiz-engine";
import { getPlayer } from "@sportverse/sports-db";

type Navigate = (route: "hub" | "quiz" | "football-iq" | "goalkeeper", param?: string) => void;

export function renderQuiz(root: HTMLElement, modeId: string | undefined, navigate: Navigate) {
  const mode = QUIZ_MODES.find((m) => m.id === modeId) ?? QUIZ_MODES[0]!;

  root.innerHTML = `
    <div class="shell">
      <div class="game-head">
        <button class="btn btn--ghost" id="back">← Hub</button>
        <h1>${mode.title}</h1>
        <p class="muted">${contentPoolSize()} verified rounds</p>
      </div>
      <div id="quiz-stage"></div>
    </div>
  `;

  root.querySelector("#back")?.addEventListener("click", () => navigate("hub"));
  const stage = root.querySelector("#quiz-stage") as HTMLElement;

  switch (mode.id) {
    case "who-am-i":
      renderWhoAmI(stage);
      break;
    case "guess-club":
      renderGuessClub(stage);
      break;
    case "true-false":
      renderTrueFalse(stage);
      break;
    case "speed-round":
      renderSpeedRound(stage, navigate);
      break;
    case "career-path":
      renderCareerPath(stage);
      break;
  }
}

function grantQuiz(result: { xpEarned: number; coinsEarned: number; score: number; correct: boolean }) {
  const achievementId =
    result.score >= 500 ? ACHIEVEMENTS.QUIZ_MASTER.id : result.correct ? ACHIEVEMENTS.FIRST_GAME.id : undefined;
  platform.grantReward({ xp: result.xpEarned, coins: result.coinsEarned, achievementId });
  if (result.correct) {
    const p = platform.getProfile();
    platform.saveLocal({ ...p, stats: { ...p.stats, quizWins: p.stats.quizWins + 1 } });
  }
}

function nextRoundButton(deck: IdDeck<{ id: string }>, onNext: () => void): string {
  return deck.hasMore
    ? `<button class="btn" id="again">Next round (${deck.round}/${deck.total})</button>`
    : `<button class="btn" id="again">Session complete — replay</button>`;
}

function renderWhoAmI(stage: HTMLElement) {
  const deck = createWhoAmIDeck();

  function startRound() {
    const player = deck.next();
    if (!player) {
      stage.innerHTML = `<div class="result"><strong>All ${deck.total} players complete!</strong><button class="btn" id="replay">New session</button></div>`;
      stage.querySelector("#replay")?.addEventListener("click", () => renderWhoAmI(stage));
      return;
    }

    let state = startWhoAmI(player.id);
    let answered = false;

    function showResult(result: ReturnType<typeof answerWhoAmI>) {
      answered = true;
      const clues = player.clues.slice(0, state.cluesRevealed);
      grantQuiz(result);
      stage.innerHTML = `
        <p class="muted">Round ${deck.round} / ${deck.total}</p>
        <div class="panel"><p>${clues.map((c, i) => `${i + 1}. ${c}`).join("<br/>")}</p></div>
        <div class="result ${result.correct ? "" : "result--bad"}">
          <strong>${result.correct ? "Correct!" : "Wrong"}</strong> +${result.xpEarned} XP · +${result.coinsEarned} coins
          <p>${result.details}</p>
          ${nextRoundButton(deck, startRound)}
        </div>`;
      stage.querySelector("#again")?.addEventListener("click", () => {
        if (deck.hasMore) startRound();
        else renderWhoAmI(stage);
      });
    }

    function draw() {
      if (answered) return;
      const clues = player.clues.slice(0, state.cluesRevealed);
      stage.innerHTML = `
        <p class="muted">Round ${deck.round} / ${deck.total}</p>
        <div class="panel"><p>${clues.map((c, i) => `${i + 1}. ${c}`).join("<br/>")}</p></div>
        <input type="text" id="guess" placeholder="Player name…" />
        <button class="btn btn--block" id="submit">Submit</button>
        <button class="btn btn--ghost btn--block" id="clue" ${state.cluesRevealed >= player.clues.length ? "disabled" : ""}>Next clue (−points)</button>
        <div id="out"></div>
      `;
      stage.querySelector("#clue")?.addEventListener("click", () => {
        if (answered) return;
        state = revealNextClue(state);
        draw();
      });
      stage.querySelector("#submit")?.addEventListener("click", () => {
        if (answered) return;
        const guess = (stage.querySelector("#guess") as HTMLInputElement).value;
        showResult(answerWhoAmI(state, guess));
      });
      const input = stage.querySelector("#guess") as HTMLInputElement;
      input?.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !answered) {
          e.preventDefault();
          showResult(answerWhoAmI(state, input.value));
        }
      });
    }
    draw();
  }

  startRound();
}

function renderGuessClub(stage: HTMLElement) {
  const deck = createGuessClubDeck();

  function startRound() {
    const club = deck.next();
    if (!club) {
      stage.innerHTML = `<div class="result"><strong>All ${deck.total} clubs complete!</strong><button class="btn" id="replay">New session</button></div>`;
      stage.querySelector("#replay")?.addEventListener("click", () => renderGuessClub(stage));
      return;
    }

    let cluesRevealed = 1;
    let answered = false;

    function showResult(result: ReturnType<typeof answerGuessClub>) {
      answered = true;
      const clues = club.clues.slice(0, cluesRevealed);
      grantQuiz(result);
      stage.innerHTML = `
        <p class="muted">Round ${deck.round} / ${deck.total}</p>
        <div class="panel"><p>${clues.map((c) => `• ${c}`).join("<br/>")}</p></div>
        <div class="result ${result.correct ? "" : "result--bad"}">
          <strong>${result.correct ? "Yes!" : `No — ${club.name}`}</strong> +${result.xpEarned} XP
          ${nextRoundButton(deck, startRound)}
        </div>`;
      stage.querySelector("#again")?.addEventListener("click", () => {
        if (deck.hasMore) startRound();
        else renderGuessClub(stage);
      });
    }

    function draw() {
      if (answered) return;
      const clues = club.clues.slice(0, cluesRevealed);
      stage.innerHTML = `
        <p class="muted">Round ${deck.round} / ${deck.total}</p>
        <div class="panel"><p>${clues.map((c) => `• ${c}`).join("<br/>")}</p></div>
        <input type="text" id="guess" placeholder="Club name…" />
        <button class="btn btn--block" id="submit">Submit</button>
        <button class="btn btn--ghost btn--block" id="clue" ${cluesRevealed >= club.clues.length ? "disabled" : ""}>Next clue</button>
        <div id="out"></div>`;
      stage.querySelector("#clue")?.addEventListener("click", () => {
        if (answered) return;
        cluesRevealed++;
        draw();
      });
      stage.querySelector("#submit")?.addEventListener("click", () => {
        if (answered) return;
        const guess = (stage.querySelector("#guess") as HTMLInputElement).value;
        showResult(answerGuessClub(club, cluesRevealed, guess));
      });
    }
    draw();
  }

  startRound();
}

function renderTrueFalse(stage: HTMLElement) {
  const deck = createTrueFalseDeck();

  function startRound() {
    const stmt = deck.next();
    if (!stmt) {
      stage.innerHTML = `<div class="result"><strong>All ${deck.total} statements complete!</strong><button class="btn" id="replay">New session</button></div>`;
      stage.querySelector("#replay")?.addEventListener("click", () => renderTrueFalse(stage));
      return;
    }

    let answered = false;

    stage.innerHTML = `
      <p class="muted">Round ${deck.round} / ${deck.total}</p>
      <div class="panel"><p>${stmt.text}</p></div>
      <button class="btn btn--block" data-a="true">True</button>
      <button class="btn btn--block btn--ghost" data-a="false">False</button>
      <div id="out"></div>`;

    function showResult(result: ReturnType<typeof answerTrueFalse>) {
      answered = true;
      grantQuiz(result);
      stage.innerHTML = `
        <p class="muted">Round ${deck.round} / ${deck.total}</p>
        <div class="panel"><p>${stmt.text}</p></div>
        <div class="result ${result.correct ? "" : "result--bad"}">
          <strong>${result.correct ? "Correct" : "Incorrect"}</strong>
          <p>${result.details}</p>
          ${nextRoundButton(deck, startRound)}
        </div>`;
      stage.querySelector("#again")?.addEventListener("click", () => {
        if (deck.hasMore) startRound();
        else renderTrueFalse(stage);
      });
    }

    stage.querySelectorAll("[data-a]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (answered) return;
        const answer = (btn as HTMLElement).dataset.a === "true";
        showResult(answerTrueFalse(stmt.id, answer));
      });
    });
  }

  startRound();
}

function renderSpeedRound(stage: HTMLElement, navigate: Navigate) {
  const deck = createSpeedQuestionDeck();
  let state = startSpeedRound(60_000);
  let q = deck.next();
  const start = Date.now();

  const tick = setInterval(() => {
    state = { ...state, timeLeftMs: Math.max(0, 60_000 - (Date.now() - start)) };
    const t = stage.querySelector(".timer");
    if (t) t.textContent = `${Math.ceil(state.timeLeftMs / 1000)}s`;
    if (state.timeLeftMs <= 0) {
      clearInterval(tick);
      const final = finalizeSpeedRound(state);
      grantQuiz(final);
      stage.innerHTML = `<div class="result"><strong>Time!</strong> Score ${final.score} · ${state.questionsAnswered} answered · +${final.xpEarned} XP<button class="btn" id="hub">Hub</button></div>`;
      stage.querySelector("#hub")?.addEventListener("click", () => navigate("hub"));
    }
  }, 200);

  function drawQ() {
    if (!q) q = deck.next();
    if (!q) {
      clearInterval(tick);
      stage.innerHTML = `<div class="result"><strong>Question pool exhausted this session!</strong></div>`;
      return;
    }

    const current = q;
    stage.innerHTML = `
      <div class="timer">${Math.ceil(state.timeLeftMs / 1000)}s</div>
      <p class="muted">Answered: ${state.questionsAnswered}</p>
      <div class="panel"><p><strong>${current.prompt}</strong></p></div>
      <div class="options">
        ${current.options.map((o, i) => `<button class="btn btn--block btn--ghost" data-i="${i}">${o}</button>`).join("")}
      </div>`;
    stage.querySelectorAll("[data-i]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number((btn as HTMLElement).dataset.i);
        const { state: next } = answerSpeedQuestion(state, current.id, i);
        state = next;
        q = deck.next();
        if (state.timeLeftMs > 0) drawQ();
      });
    });
  }
  drawQ();
}

function renderCareerPath(stage: HTMLElement) {
  const deck = createCareerPathDeck();

  function startRound() {
    const entry = deck.next();
    if (!entry) {
      stage.innerHTML = `<div class="result"><strong>All ${deck.total} career paths complete!</strong><button class="btn" id="replay">New session</button></div>`;
      stage.querySelector("#replay")?.addEventListener("click", () => renderCareerPath(stage));
      return;
    }

    const player = getPlayer(entry.playerId);
    const label = player?.name ?? entry.playerId;
    const shuffled = [...entry.clubs].sort(() => Math.random() - 0.5);
    let order = [...shuffled];
    const pathId = entry.id;
    let answered = false;

    function showResult(result: ReturnType<typeof submitCareerPath>) {
      answered = true;
      grantQuiz(result);
      stage.innerHTML = `
        <p class="muted">Round ${deck.round} / ${deck.total}</p>
        <div class="panel"><p>Career path for <strong>${label}</strong></p></div>
        <ul class="order-list order-list--locked">${order.map((c) => `<li>${c}</li>`).join("")}</ul>
        <div class="result ${result.correct ? "" : "result--bad"}">
          <strong>${result.correct ? "Perfect!" : "Partial"}</strong> +${result.score} pts
          ${nextRoundButton(deck, startRound)}
        </div>`;
      stage.querySelector("#again")?.addEventListener("click", () => {
        if (deck.hasMore) startRound();
        else renderCareerPath(stage);
      });
    }

    function draw() {
      if (answered) return;
      stage.innerHTML = `
        <p class="muted">Round ${deck.round} / ${deck.total}</p>
        <div class="panel"><p>Drag to order clubs chronologically for <strong>${label}</strong></p></div>
        <ul class="order-list" id="list">${order.map((c) => `<li draggable="true">${c}</li>`).join("")}</ul>
        <button class="btn btn--block" id="submit">Submit order</button>
        <div id="out"></div>`;

      const list = stage.querySelector("#list")!;
      let dragEl: HTMLElement | null = null;
      list.querySelectorAll("li").forEach((li) => {
        li.addEventListener("dragstart", () => {
          dragEl = li as HTMLElement;
        });
        li.addEventListener("dragover", (e) => e.preventDefault());
        li.addEventListener("drop", () => {
          if (!dragEl || dragEl === li) return;
          const items = [...list.querySelectorAll("li")];
          const from = items.indexOf(dragEl);
          const to = items.indexOf(li as HTMLElement);
          order.splice(to, 0, order.splice(from, 1)[0]!);
          draw();
        });
      });

      stage.querySelector("#submit")?.addEventListener("click", () => {
        if (answered) return;
        showResult(submitCareerPath({ pathId, playerOrder: order, submitted: true, correct: false }, order));
      });
    }
    draw();
  }

  startRound();
}
