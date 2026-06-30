# SPORTVERSE

A living universe of interconnected sports games — one account, one XP, one currency.

**Phase 1 Alpha** includes:
- **Football IQ** — 5 tactical scenarios with post-decision coaching
- **Goalkeeper Instinct** — 20 levels reading body language
- **Sports IQ** — 5 quiz modes (Who Am I, Speed Round, Guess Club, Career Path, True/False)
- **Platform** — guest profiles, XP, coins, streaks, achievements, daily challenge, leaderboard API

## Run locally

```bash
cd sportverse
npm install

# Terminal 1 — API (port 8792)
npm run dev:api

# Terminal 2 — Web PWA (port 5174)
npm run dev
```

Open http://localhost:5174

**Port already in use?** A previous `dev:api` may still be running. Either:
- Kill it: `netstat -ano | findstr :8792` then `taskkill /PID <pid> /F`
- Or set another port: `set PORT=8793` (Windows) / `PORT=8793 npm run dev:api`

The API auto-falls back to the next free port (8793, 8794…) and prints a warning.

## Test

```bash
npm test
```

## Structure

```
sportverse/
  apps/web/              Vite PWA shell
  services/api/          Hono player-state API
  packages/platform/     XP, coins, achievements client
  packages/quiz-engine/  Shared quiz mechanics
  packages/sim-core/     Football IQ + Goalkeeper sims
  packages/sports-db/    Curated sports content JSON
```

## Deploy

- **Web:** `npm run build -w @sportverse/web` → deploy `apps/web/dist` to Netlify/Vercel
- **API:** Deploy `services/api` to Railway/Render with `PORT` and `SPORTVERSE_DATABASE_PATH`

Set `VITE_API_URL` in web build env to your API URL.

**Note:** Internal packages resolve TypeScript source directly — no `dist/` build required for local dev. Production API runs via `tsx` (included in API dependencies).

## Env

| Variable | Service | Description |
|----------|---------|-------------|
| `VITE_API_URL` | web | API base URL |
| `PORT` | api | Default 8792 |
| `SPORTVERSE_DATABASE_PATH` | api | Player JSON store |
