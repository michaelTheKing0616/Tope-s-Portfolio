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

1. **Try GitHub Release bundle** — downloads `sports-db-data.tar.gz` from the `sports-db-latest` release (built by CI; fast path ~1–2 min)
2. **Fallback ETL** if no release yet:
   - Clone `https://github.com/datasets/football-datasets.git` → `sportverse/data/raw/`
   - World Cup + top-5 leagues base dataset
   - Transfermarkt CDN fallback (replaces local `sportverse/archive/` which is not in git)
3. **Writes** `sportverse/packages/sports-db/data/season-stats.json` and related JSON
4. **Verifies** all required files exist before continuing
5. **Installs** SPORTVERSE monorepo dependencies

---

## GitHub Actions — build the complete database

Workflow: `.github/workflows/build-sports-db.yml`

**Run it once** (then weekly on schedule):

1. GitHub → **Actions** → **Build SPORTVERSE database** → **Run workflow**
2. Optional: enable **use_archive** if you set repo secret `SPORTVERSE_ARCHIVE_URL` (see **Host the archive zip** below)
3. CI runs ETL, packages `sports-db-data.tar.gz`, publishes to release **`sports-db-latest`**

After CI succeeds, Netlify redeploy downloads the bundle instead of re-running ETL.

### Host the archive zip (no GitHub CLI required)

Upload `sportverse-archive.zip` (~82 MB) to any of these, then paste the URL into secret **`SPORTVERSE_ARCHIVE_URL`**.

| Host | How to upload | Secret URL example |
|---|---|---|
| **Google Drive** (easiest if already uploaded) | Share → Anyone with link | `https://drive.google.com/file/d/YOUR_ID/view?usp=sharing` |
| **Cloudflare R2** | Dashboard → bucket → upload → public URL | `https://pub-xxxxx.r2.dev/sportverse-archive.zip` |
| **Dropbox** | Upload → Share → change `?dl=0` to `?dl=1` | `https://www.dropbox.com/s/xxx/archive.zip?dl=1` |

CI auto-detects Google Drive and uses **gdown** (plain `curl` fails on large Drive files).

**Local test (Google Drive):**

```powershell
pip install gdown
$env:ARCHIVE_URL = "https://drive.google.com/file/d/YOUR_ID/view?usp=sharing"
node scripts/download-archive-url.mjs
```

Uses `python -m gdown` (Windows) or `python3 -m gdown` (Linux/CI). Requires Python on PATH locally.

Zip layout: folders `player_profiles/`, `player_performances/`, etc. at the **root** of the zip (zip from inside `sportverse/archive/`).

**Run CI with archive:** Actions → Build SPORTVERSE database → check **use_archive** → Run.

| Build type | What you get |
|---|---|
| **Default CI** | football-datasets + TM CDN (~50k players, full season-stats for deploy) |
| **CI + archive secret** | Full Transfermarkt archive pool (~90k+ players, richest stats) |
| **Local `--build` with archive** | Same as archive CI; 287MB season-stats stays local/gitignored |

Release URL (Netlify default):

`https://github.com/michaelTheKing0616/Tope-s-Portfolio/releases/download/sports-db-latest/sports-db-data.tar.gz`

Override with env `SPORTS_DB_BUNDLE_URL` on Netlify if needed.

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
| `season-stats.json (404)` | Run GitHub Actions **Build SPORTVERSE database**, wait for release, redeploy Netlify |
| `Extended data not loaded` | Same — data JSON missing from deploy; confirm `/play/sportverse/data/players-extended.json` returns 200 |
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
