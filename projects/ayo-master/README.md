# Ayo Master

Ayoayo (a Yoruba game in the Mancala family) rebuilt as a clean, playable
showcase — with a **minimax + alpha-beta** AI opponent at selectable difficulty.

> Part of the portfolio of Temitope Olaitan. The point of this project is
> algorithmic depth made playable: a real adversarial-search AI wrapped in a
> polished, accessible UI, with the game logic isolated as a pure, tested engine.

## Architecture

The defining decision is the separation of concerns:

```
engine.ts   Pure, deterministic rules (sowing, capture, end-game). No DOM, no timers.
ai.ts       Minimax + alpha-beta over the engine. North maximises, South minimises.
main.ts     The browser UI. Renders the board and drives the turn loop.
*.test.ts   Unit tests against the engine and AI (Vitest).
```

Because the engine is pure, the AI can simulate thousands of hypothetical boards
cheaply, the tests are deterministic, and the same code could power a server or
self-play with no changes.

## Rules implemented (Kalah variant)

- Pick a non-empty pit on your row; sow its seeds one-per-pit counter-clockwise,
  **skipping the opponent's store**.
- Last seed in **your store** → play again.
- Last seed in an **empty pit on your side** → capture it plus the seeds directly
  opposite.
- When either row empties, each side banks its remaining seeds; most seeds wins.

## The AI

`chooseMove` runs minimax with alpha-beta pruning to a difficulty-based depth
(easy 2 / medium 5 / hard 9). The evaluation favours banked seeds, with on-board
material as a tie-breaker. The extra-turn rule means turns don't strictly
alternate, so the search tracks whose move it is at each node. A self-play test
asserts that the hard AI reliably beats a random player.

## Run

```bash
npm install
npm run dev        # play locally
npm test           # engine + AI unit tests
npm run build      # production bundle
```

## License

MIT
