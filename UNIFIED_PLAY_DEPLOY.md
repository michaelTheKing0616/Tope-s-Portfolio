# Unified Play Deploy — One Site, All Games

Deploy your **Astro portfolio** and **SPORTVERSE** (1000+ rounds per game) as a **single web app** on Netlify or Vercel. Visitors open your domain, go to `/play`, and play every game without leaving the site.

---

## Architecture

```
your-site.netlify.app/          ← Astro portfolio (static)
├── /                           ← Home, work, contact
├── /demos                      ← Case-study demos
├── /play                       ← Games hub (Astro page)
└── /play/sportverse/           ← SPORTVERSE PWA (Vite build, embedded)
    ├── index.html
    ├── assets/
    └── … (1000+ procedural rounds, client-side)
```

| Layer | What runs where | Needs server? |
|--------|-----------------|---------------|
| Portfolio | Netlify/Vercel static | No |
| SPORTVERSE games | Static files in `public/play/sportverse/` | No (offline-capable PWA) |
| SPORTVERSE API (XP sync, leaderboard) | Optional — Render/Railway/Fly | Yes (only if you want cloud sync) |

**Default setup:** Games work fully offline with **localStorage** profile (guest mode). The API is optional for leaderboards across devices.

---

## How content works (1000+ per game)

SPORTVERSE uses procedural generation in `@sportverse/content-gen`:

| Game | Pool size | Session behavior |
|------|-----------|------------------|
| Football IQ | 1000 scenarios | Shuffled deck, no repeats until session ends |
| Goalkeeper Instinct | 1000 levels | Same |
| Who Am I? | 1000 players | Same |
| Guess the Club | 1000 clubs | Same |
| True/False | 1000 statements | Same |
| Career Path | 1000 paths | Same |
| Speed Round | 1000+ questions | Random draw during 60s timer |

Content is generated at runtime in the browser (seeded PRNG) — no 50MB JSON bundles.

---

## Local development

### Portfolio only (no games rebuild)

```powershell
cd "C:\Users\HP\Desktop\Web portfolio"
npm install
npm run dev
```

Open [http://localhost:4321](http://localhost:4321)

### Portfolio + embedded SPORTVERSE

```powershell
# Terminal 1 — build games into public/play/sportverse/
npm run build:games

# Terminal 2 — portfolio dev server
npm run dev
```

Play at [http://localhost:4321/play/sportverse/](http://localhost:4321/play/sportverse/)

### SPORTVERSE standalone (faster game iteration)

```powershell
cd sportverse
npm install
npm run dev          # web :5174
npm run dev:api      # API :8792 (optional)
```

---

## Production build

```powershell
cd "C:\Users\HP\Desktop\Web portfolio"
npm install
npm run build
```

This runs:

1. `build:games` — builds Vite app with `VITE_BASE_PATH=/play/sportverse/`, copies to `public/play/sportverse/`
2. `astro build` — outputs `dist/` including embedded games

Verify locally:

```powershell
npm run preview
# → http://localhost:4321/play/sportverse/
```

---

## Deploy to Netlify (recommended)

### 1. Push to GitHub

```powershell
cd "C:\Users\HP\Desktop\Web portfolio"
git init
git add .
git commit -m "Portfolio with embedded SPORTVERSE"
git remote add origin https://github.com/YOUR_USER/portfolio.git
git push -u origin main
```

### 2. Create Netlify site

1. [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import from Git**
2. Select your repo
3. Settings (also in `netlify.toml`):
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
   - **Node version:** 20

### 3. Environment variables

| Variable | Required | Example | Purpose |
|----------|----------|---------|---------|
| `PUBLIC_SITE_URL` | Yes | `https://your-name.netlify.app` | Sitemap, robots, canonical URLs, OG tags |

Set in **Site configuration → Environment variables**, then redeploy.

### 4. Custom domain (optional)

1. Netlify → **Domain management** → add domain
2. Update `PUBLIC_SITE_URL` to `https://yourdomain.com`
3. Redeploy

### 5. Play URLs after deploy

- Games hub: `https://your-site.netlify.app/play`
- SPORTVERSE: `https://your-site.netlify.app/play/sportverse/`

`netlify.toml` includes a redirect from `/play/sportverse` → `/play/sportverse/` (trailing slash required for Vite `base` path).

---

## Deploy to Vercel

### 1. Import project

1. [vercel.com/new](https://vercel.com/new) → import GitHub repo
2. Framework: **Astro**
3. **Build command:** `npm run build`
4. **Output directory:** `dist`

### 2. `vercel.json` (repo root)

Create if missing:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "astro",
  "redirects": [
    { "source": "/play/sportverse", "destination": "/play/sportverse/", "permanent": true }
  ]
}
```

### 3. Environment variables

Same as Netlify: set `PUBLIC_SITE_URL` to your Vercel URL or custom domain.

---

## Optional: SPORTVERSE API (leaderboard / cloud profile)

If you want cross-device XP and leaderboards:

### Deploy API (Render example)

1. Create **Web Service** from `sportverse/services/api`
2. **Build:** `cd sportverse && npm install && npm run build:api`
3. **Start:** `cd sportverse && npm run start -w @sportverse/api`
4. Note the URL, e.g. `https://sportverse-api.onrender.com`

### Point the embedded app at your API

Before `npm run build:games`, set in `sportverse/apps/web/.env.production`:

```env
VITE_API_URL=https://sportverse-api.onrender.com
```

Or pass at build time:

```powershell
$env:VITE_API_URL="https://sportverse-api.onrender.com"
npm run build:games
```

CORS on the API must allow your portfolio origin (`https://your-site.netlify.app`).

---

## Adding more games later

To embed another static game (e.g. Pulse WebGL) at `/play/pulse/`:

1. Build the game with `base: '/play/pulse/'`
2. Extend `scripts/build-embedded-games.mjs` to copy its `dist/` → `public/play/pulse/`
3. Add a card on `src/pages/play/index.astro`
4. Redeploy — one `npm run build`, one site

Games that need a **Node backend** (Kobo, Akowe) should stay as separate deploys or API subdomains; link from `/play` rather than embedding.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Blank page at `/play/sportverse/` | Re-run `npm run build:games`; ensure trailing slash in URL |
| Assets 404 (`/assets/...` instead of `/play/sportverse/assets/...`) | Rebuild with `VITE_BASE_PATH=/play/sportverse/` |
| `npm run build` slow on Netlify | Normal first time — SPORTVERSE installs + builds; cache `sportverse/node_modules` if needed |
| Leaderboard empty | API not deployed or `VITE_API_URL` not set — games still work offline |
| Old content after deploy | Hard refresh; PWA may cache — bump version in `vite.config.ts` manifest |

---

## Quick checklist

- [ ] `npm run build` succeeds locally
- [ ] `/play` and `/play/sportverse/` work in `npm run preview`
- [ ] `PUBLIC_SITE_URL` set on host
- [ ] Trailing-slash redirect configured
- [ ] (Optional) API deployed + `VITE_API_URL` set at game build time

One deploy. One domain. All games playable in the same web app.
