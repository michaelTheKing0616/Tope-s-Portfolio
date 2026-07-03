# Netlify deploy — DRAFTBALLER / SPORTVERSE

## One-click redeploy

In Netlify: **Deploys → Trigger deploy → Deploy site** (or push to `main`).

The build runs automatically:

```
npm run build
  ├─ prebuild:data   (scripts/netlify-prebuild.mjs)
  ├─ build:games     (SPORTVERSE → public/play/sportverse/)
  └─ astro build     (portfolio → dist/)
```

No manual seed step is required on Netlify.

---

## Netlify site settings

| Setting | Value |
|---|---|
| **Build command** | `npm run build` |
| **Publish directory** | `dist` |
| **Node version** | `20` (from `netlify.toml`) |
| **Build timeout** | **20–25 min** recommended (first build can be slow) |

Environment variables (optional):

| Variable | Purpose |
|---|---|
| `PUBLIC_SITE_URL` | Your Netlify URL for OG tags |
| `SKIP_DATA_SEED=1` | **Local only** — skip ETL when testing Astro (`npm run build:skip-data` is easier) |

---

## What `prebuild:data` does

1. **Clone** `https://github.com/datasets/football-datasets.git` → `sportverse/data/raw/`
2. **ETL** — World Cup + top-5 leagues base dataset
3. **Transfermarkt CDN fallback** — downloads compressed player/stats feed (replaces local `sportverse/archive/` which is not in git)
4. **Writes** `sportverse/packages/sports-db/data/season-stats.json` and related JSON
5. **Keeps** git-tracked calibration files (`engine-calibration.json`, `player-transfers.json`, etc.) when archive is absent
6. **Verifies** all required files exist before continuing
7. **Installs** SPORTVERSE monorepo dependencies

---

## After deploy — test these URLs

| URL | Expect |
|---|---|
| `/play/sportverse/` | SPORTVERSE hub loads |
| `/play/sportverse/#/draftballer` | DRAFTBALLER hub, player count > 0 |
| `/play/sportverse/#/draftballer/wheel` | Wheel draft works |
| `/play/sportverse/#/draftballer/room` | Snake draft vs bot |
| `/play/sportverse/#/draftballer/auction` | Auction draft |
| `/play/sportverse/data/season-stats.json` | Large JSON (not 404) |
| `/play/sportverse/data/engine-calibration.json` | Present |

---

## Local commands (mirror Netlify)

```bash
# Full production build (same as Netlify)
npm run build

# Data seed only
npm run prebuild:data

# Skip ETL if season-stats.json already exists locally
npm run build:skip-data

# Full local archive pool (best ratings, not on Netlify)
node scripts/seed-external-data.mjs --clone
node scripts/seed-external-data.mjs --build
cd sportverse && npx tsx scripts/calibrate-engine.ts --write
npm run build:skip-data
```

---

## Deploy vs local archive

| Source | Netlify | Local with `sportverse/archive/` |
|---|---|---|
| Player pool | football-datasets + TM CDN (~50k+) | ~90k+ TM archive rows |
| season-stats | Generated each build | Full 1.88M rows possible |
| LSI calibration | Committed `engine-calibration.json` | Can re-run `calibrate-engine.ts` |
| Build time | ~8–15 min | Archive ETL slower but richer |

Netlify deploy is **fully playable** for all modes; local archive is **maximum realism** when you need the full TM dataset.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Build fails “Missing season-stats.json” | Check Netlify logs for CDN/clone errors; increase timeout |
| “Transfermarkt CDN ETL failed” | Transient network — retry deploy |
| Out of memory | `NODE_OPTIONS=--max-old-space-size=4096` is in `netlify.toml` |
| Stale game data after deploy | Hard refresh; data JSON cache is 1 hour (`netlify.toml`) |
| Empty player pool in UI | Confirm `/play/sportverse/data/players-extended.json` returns 200 |

Build log should end with:

```
✓ Netlify prebuild complete — ready for build:games
✓ SPORTVERSE embedded at public/play/sportverse/
```
