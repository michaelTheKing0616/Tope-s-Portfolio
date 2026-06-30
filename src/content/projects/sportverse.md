---
title: "SPORTVERSE"
tagline: "A living universe of interconnected sports games — one XP, one legend."
domain: "Games + Platform"
domains: ["Games", "Web", "AI"]
status: "in-progress"
year: "2026"
stack: ["TypeScript", "Vite PWA", "Hono", "Quiz engine", "Tactical sim"]
skill: "Sports gaming platform — shared progression, skill games, and Sports IQ quizzes"
seniorSignal: "Platform thinking, not a game list — unified economy, daily loops, pure sim engines with tests."
summary: "Web PWA sports platform: Football IQ tactical puzzles, Goalkeeper Instinct (20 levels), Sports IQ quiz hub (5 modes), shared XP/coins/achievements, and leaderboard API."
order: 2
featured: true
demo: "sportverse"
links: []
---

## The problem

Sports games are usually isolated titles — no shared identity, no learning loop, no reason to return daily. Quiz apps ask "Who won 2018?" and stop. SPORTVERSE treats sports gaming as a **platform**: every mode feeds one player becoming a Sports Legend.

## What I built

`sportverse/` — npm workspaces monorepo:

```text
apps/web (Vite PWA)
     │
     ├── Football IQ (sim-core — 5 scenarios)
     ├── Goalkeeper Instinct (20 levels)
     └── Sports IQ (5 quiz modes)
     │
     ▼
packages/platform (XP, coins, streak, achievements)
     │
     ▼
services/api (Hono — persistent player state)
```

## Senior signals

- **Pure sim engines** with Vitest (Ayo Master pattern)
- **Shared quiz engine** — one codebase, five modes
- **Platform loop** — daily challenge, leaderboard, collections-ready achievements
- **Offline-first guest play** with optional API sync

## Run

```bash
cd sportverse && npm install
npm run dev:api   # :8792
npm run dev       # :5174
```
