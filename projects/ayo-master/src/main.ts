import "./style.css";
import {
  type Board,
  type Player,
  initialBoard,
  applyMove,
  legalMoves,
  isGameOver,
  finalize,
  storeCount,
  PITS,
} from "./engine.js";
import { chooseMove, type Difficulty } from "./ai.js";

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const root = document.querySelector<HTMLElement>("[data-game]")!;
const statusEl = root.querySelector<HTMLElement>("[data-status]")!;
const diffEl = root.querySelector<HTMLSelectElement>("[data-diff]")!;
const newBtn = root.querySelector<HTMLButtonElement>("[data-new]")!;
const northRow = root.querySelector<HTMLElement>('[data-row="north"]')!;
const southRow = root.querySelector<HTMLElement>('[data-row="south"]')!;

let board: Board = initialBoard();
let turn: Player = "south";
let busy = false;

// Build pit buttons once. North is rendered right-to-left to mirror the physical
// board's counter-clockwise flow.
const pitEls = new Map<number, HTMLButtonElement>();
for (const pit of [...PITS.north].slice().reverse()) northRow.appendChild(makePit(pit, "north"));
for (const pit of PITS.south) southRow.appendChild(makePit(pit, "south"));

function makePit(pit: number, side: Player): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = `pit pit--${side}`;
  btn.dataset.pit = String(pit);
  btn.innerHTML = `<span class="pit__count">0</span>`;
  if (side === "south") btn.addEventListener("click", () => playerMove(pit));
  else btn.disabled = true;
  pitEls.set(pit, btn);
  return btn;
}

function setStatus(msg: string, kind: "" | "win" | "lose" = "") {
  statusEl.textContent = msg;
  statusEl.classList.toggle("is-win", kind === "win");
  statusEl.classList.toggle("is-lose", kind === "lose");
}

function render(highlight?: { last?: number; capture?: boolean }) {
  pitEls.forEach((btn, pit) => {
    const count = board[pit]!;
    btn.querySelector(".pit__count")!.textContent = String(count);
    btn.classList.toggle("is-empty", count === 0);
    const side: Player = PITS.south.includes(pit) ? "south" : "north";
    btn.disabled = !(turn === "south" && side === "south" && count > 0 && !busy);
    btn.setAttribute(
      "aria-label",
      side === "south"
        ? `Your pit, ${count} seeds${btn.disabled ? "" : " — play"}`
        : `AI pit, ${count} seeds`,
    );
    if (highlight?.last === pit && !reduced) {
      btn.classList.add("is-sown");
      setTimeout(() => btn.classList.remove("is-sown"), 420);
    }
  });
  root.querySelector('[data-store="6"]')!.textContent = String(storeCount(board, "south"));
  root.querySelector('[data-store="13"]')!.textContent = String(storeCount(board, "north"));
}

function endGame() {
  board = finalize(board);
  render();
  const me = storeCount(board, "south");
  const ai = storeCount(board, "north");
  if (me > ai) setStatus(`You win, ${me}-${ai}. Well played.`, "win");
  else if (ai > me) setStatus(`AI wins, ${ai}-${me}. Try Hard next time.`, "lose");
  else setStatus(`A draw, ${me}-${me}.`);
}

function aiTurn() {
  if (isGameOver(board)) return endGame();
  busy = true;
  render();
  setStatus("AI is thinking...");
  setTimeout(
    () => {
      const move = chooseMove(board, "north", { difficulty: diffEl.value as Difficulty });
      const r = applyMove(board, move, "north");
      board = r.board;
      render({ last: r.lastIndex, capture: r.captured > 0 });
      if (isGameOver(board)) return endGame();
      if (r.extraTurn) {
        setStatus("AI landed in its store - it goes again.");
        setTimeout(aiTurn, reduced ? 120 : 650);
      } else {
        busy = false;
        turn = "south";
        render();
        setStatus(r.captured ? `AI captured ${r.captured}. Your move.` : "Your move.");
      }
    },
    reduced ? 120 : 520,
  );
}

function playerMove(pit: number) {
  if (busy || turn !== "south" || board[pit]! === 0) return;
  const r = applyMove(board, pit, "south");
  board = r.board;
  render({ last: r.lastIndex, capture: r.captured > 0 });
  if (isGameOver(board)) return endGame();
  if (r.extraTurn) {
    setStatus("You landed in your store - go again.");
    return;
  }
  turn = "north";
  aiTurn();
}

function newGame() {
  board = initialBoard();
  turn = "south";
  busy = false;
  render();
  setStatus("Your move - pick one of your pits.");
}

newBtn.addEventListener("click", newGame);
diffEl.addEventListener("change", newGame);
newGame();
