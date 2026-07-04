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
2. Ensure secret **`SPORTVERSE_ARCHIVE_URL`** is set (Google Drive share link) — CI downloads it automatically every run
3. CI runs ETL, packages `sports-db-data.tar.gz`, publishes to release **`sports-db-latest`**

After CI succeeds, Netlify redeploy downloads the bundle instead of re-running ETL.

### Host the archive zip (no GitHub CLI required)

Upload `sportverse-archive.zip` (~82 MB) to any of these, then paste the URL into secret **`SPORTVERSE_ARCHIVE_URL`**.

**Create a CI-safe zip (required — do not use `Compress-Archive`):**

```powershell
cd "C:\Users\HP\Desktop\Web portfolio"
node scripts/package-archive-zip.mjs
```

This uses `tar -a` so paths use forward slashes and Linux CI can extract the zip.

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

**Run CI:** Actions → Build SPORTVERSE database → Run (no checkbox — archive is used automatically when the secret is set).

| Build type | What you get |
|---|---|
| **Default CI** | football-datasets + TM CDN (~50k players, full season-stats for deploy) |
| **CI + archive secret** | Full Transfermarkt archive pool (~90k+ players, richest stats) |
| **Local `--build` with archive** | Same as archive CI; 287MB season-stats stays local/gitignored |

### Expected release bundle sizes (archive build)

| File | Uncompressed | In tarball |
|---|---|---|
| `season-stats.json` | ~320 MB | gzip compresses well |
| `players-extended.json` | ~36 MB | included |
| **Tarball total** | ~360 MB raw JSON | **~25–30 MB compressed** ← normal |

A **25.4 MB download** is correct when CI logs show `season-stats.json (319 MB)` and `totalPlayers: 98437`. Netlify **build** extracts the tarball locally for build-time checks.

### Runtime data (production)

Large JSON is **not** fetched from GitHub at runtime (CORS + size limits). During **Netlify build**:

1. `prebuild:data` downloads `sports-db-data.tar.gz` and extracts JSON locally
2. `stage:sports-db-cdn` gzip-chunks `season-stats.json` + `players-extended.json` into `public/api/sports-db/` (~22 MB total gzip)
3. Astro copies `public/` → `dist/` — browser loads same-origin `/api/sports-db/…`

| Asset | Format | URL |
|---|---|---|
| `season-stats` | `{ source, files[], totalItems }` manifest + `season-stats-NNN.json.gz` arrays | `/api/sports-db/season-stats.chunks.json` |
| `players-extended` | same gzip chunk pattern | `/api/sports-db/players-extended.chunks.json` |
| Small JSON | plain JSON | `/play/sportverse/data/*.json` |

Set in `netlify.toml`: `VITE_SPORTS_DB_CDN=/api/sports-db` (baked into Vite build). Chunk writer: `scripts/sports-db-gzip-chunks.mjs`.

**Local dev without CDN:** loader uses uncompressed chunks at `/play/sportverse/data/chunks/{name}.manifest.json` + `{name}/NNN.json` (different manifest shape — `chunkCount` not `files[]`).

**GitHub Release gzip assets** (`season-stats.chunks.json`, etc.) are published by CI for backup/mirror only; Netlify does not proxy them at runtime.

Release tarball (build-time download):

`https://github.com/michaelTheKing0616/Tope-s-Portfolio/releases/download/sports-db-latest/sports-db-data.tar.gz`

---

## After deploy — test these URLs

| URL | Expect |
|---|---|
| `/play/sportverse/` | SPORTVERSE hub loads |
| `/play/sportverse/#/draftballer` | DRAFTBALLER hub, player count > 0 |
| `/play/sportverse/#/draftballer/wheel` | Wheel draft works |
| `/play/sportverse/#/draftballer/room` | Snake draft vs bot |
| `/play/sportverse/#/draftballer/auction` | Auction draft |
| `/play/sportverse/data/season-stats.json` | **404 is OK** — large data loaded from `/api/sports-db/` gzip chunks |
| `/play/sportverse/data/chunks/season-stats.manifest.json` | **404 is OK** in CDN mode |
| `/api/sports-db/season-stats.chunks.json` | JSON manifest with `files[]` array |
| `/api/sports-db/season-stats-000.json.gz` | gzip chunk (binary) |
| `/play/sportverse/data/engine-calibration.json` | Present on Netlify |

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
| `chunk manifest … returned 400/404` | Old deploy used Netlify function proxy — push latest code; confirm build log shows `Staging sports-db gzip CDN` and `CDN mode verified` |
| `season-stats.json (404)` under `/play/sportverse/data/` | **Expected** in CDN mode — data is at `/api/sports-db/season-stats.chunks.json` |
| `Failed to load season-stats.json` in UI | Check `/api/sports-db/season-stats.chunks.json` returns JSON; rebuild if missing |
| `Extended data not loaded` | CDN staging failed — check Netlify build logs for `stage:sports-db-cdn` errors |
| Build fails “Missing season-stats.json” | Check Netlify logs for release download / ETL errors; increase timeout |
| “Transfermarkt CDN ETL failed” | Transient network — retry deploy |
| Out of memory | `NODE_OPTIONS=--max-old-space-size=4096` is in `netlify.toml`; gzip chunk step needs ~4GB during build |
| Stale game data after deploy | Hard refresh; CDN gzip cache is 1 hour (`netlify.toml`) |
| Empty player pool in UI | Confirm `/api/sports-db/players-extended.chunks.json` returns 200 with `files[]` |

Build log should end with:

```
✓ sports-db gzip CDN staged (~22 MB)
✓ CDN mode verified — N gzip files in dist/api/sports-db/
✓ SPORTVERSE embedded at public/play/sportverse/
```
