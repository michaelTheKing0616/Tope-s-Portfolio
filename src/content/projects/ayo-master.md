---
title: "Ayo Master"
tagline: "The ancient game of Ayoayo, against an AI that thinks ahead."
domain: "Games + AI"
domains: ["Games", "AI"]
status: "in-progress"
year: "2026"
stack: ["TypeScript", "Vite", "Minimax / Alpha-Beta", "Vitest"]
skill: "Game loop, state machines, adversarial search (minimax)"
seniorSignal: "Algorithmic depth made playable — a real, tested game AI wrapped in polished, accessible UX."
summary: "A browser implementation of Ayoayo (Mancala) with a minimax + alpha-beta AI opponent at selectable difficulty — a traditional African game rebuilt as a clean, playable, test-backed showcase."
order: 4
featured: true
demo: "ayo"
links: []
---

## The idea

Ayoayo (a Yoruba game in the Mancala family) is centuries old and deeply strategic — perfect for showing both cultural rootedness and computer-science fundamentals in one playable artifact.

## What I built

A standalone Vite app in `projects/ayo-master` whose defining feature is a strict separation of concerns:

```text
engine.ts   Pure, deterministic rules (sowing, capture, end-game). No DOM, no timers.
ai.ts       Minimax + alpha-beta over the engine. North maximises, South minimises.
main.ts     The browser UI. Renders the board and drives the turn loop.
*.test.ts   Unit tests against the engine and the AI (Vitest).
```

Because the engine is pure and immutable (every move returns a new board), the AI can explore thousands of hypothetical positions cheaply, the tests are deterministic, and the exact same code could drive a server or self-play with no changes.

## Engineering decisions

- **Immutable rules engine.** `applyMove` never mutates its input and throws on illegal moves, so neither the UI nor the search can corrupt game state.
- **Search that respects the rules.** The extra-turn rule means turns don't strictly alternate, so the minimax recursion tracks *whose move it is* at each node rather than assuming alternation — a subtlety naive Mancala AIs get wrong.
- **Difficulty = depth.** Easy/medium/hard map to search depths 2/5/9; easy also mixes in occasional random play so beginners can win.
- **Accessible by default.** Keyboard-playable, ARIA-labelled pits, and `prefers-reduced-motion` honoured.

## Results

- A Vitest suite asserts seed conservation, correct sowing, store skipping, capture mechanics, illegal-move rejection and end-game sweeping.
- A **self-play test** plays a full game of hard-vs-random with a seeded PRNG and asserts the stronger AI wins — a behavioural guarantee, not just unit coverage.
- Deterministic AI on medium/hard (no randomness): the same position always yields the same move.

## Senior signal

A working adversarial-search AI, a clean separation between logic and presentation, a genuinely fun result, and tests that prove it works — proof of algorithmic depth, not just CRUD.

> Play it live on the [Demos](/demos) page.
