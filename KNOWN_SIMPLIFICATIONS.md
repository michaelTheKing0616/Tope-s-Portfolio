# Known Simplifications & Deferred Work

**Updated:** 2026-07-03 — Archive calibration pipeline + routing fixes.

## Resolved (Phases 6–20 + calibration pass)

- LSI v2 (z-score ensemble, empirical Bayes, connectivity)
- Dixon–Coles Layer 1 + constrained Layer 2 event sim
- Progressive-value **proxies** with goalsConceded from archive (not true VAEP)
- DEF confidence discount
- **Aggregation bridge `f()`** — fitted on 800 archive team-season records (`engine-calibration.json`)
- **LSI ensemble weights** — fitted on 500 cross-league fixtures + 8000 transfers (holdout ~59%)
- **Bridging bounds** — fitted on 4058 transfer z-delta observations
- Auction / blind / mini-league / linear draft **routing fixed** in `main.ts`
- Calibration datasets: `player-transfers.json`, `cross-league-fixtures.json`, `team-season-records.json`

## Engine v4 — remaining honest limits


| Item                                         | Reality                                                                                                                                                                           |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **True xT/VAEP/OBV**                         | Requires event-level pass/carry/tackle chains — not in season-aggregate schema. Tier-1 uses labeled `progressive_*_proxy` + `defensive_value_proxy` (goalsConceded when present). |
| **RPS 0.2063 benchmark**                     | Citable reference for 1X2 prediction challenge; our holdout uses continental league-comparison fixtures — not identical task.                                                     |
| **Hypothetical squad validation**            | Cross-era dream matchups have no ground truth — confidence flows from §4.3.1 pipeline validation only.                                                                            |
| **Full season-stats goalsConceded backfill** | New archive ETL writes `goalsConceded`; full `--build` re-run backfills all ~1.88M rows. `--calibration-only` does not rewrite season-stats.                                      |


## Netlify deploy (automatic data seed on build)

Every `npm run build` (Netlify default) runs `**scripts/netlify-prebuild.mjs`** before embedding SPORTVERSE:

1. Clone [football-datasets](https://github.com/datasets/football-datasets) into `sportverse/data/raw/`
2. Build player pool + **season-stats.json** via football-datasets + Transfermarkt CDN (archive not on GitHub)
3. Verify required JSON artifacts (including committed `engine-calibration.json`, LSI, transfers)
4. `npm install` in `sportverse/`
5. `build:games` copies **all** `packages/sports-db/data/*.json` → `/play/sportverse/data/`
6. Astro build → `dist/`

**Netlify UI:** Build command = `npm run build`, Publish = `dist`, Node 20 (set in `netlify.toml`).  
**Recommended:** Build timeout **20–25 minutes** (ETL + CDN download).  
**Local fast build (skip ETL):** `npm run build:skip-data` if you already have `season-stats.json` locally.

**Full archive pool (local only):** Place CSVs in `sportverse/archive/`, run `node scripts/seed-external-data.mjs --build`, then deploy is optional — archive is not pushed to GitHub.

See `NETLIFY_DEPLOY.md` for step-by-step.

## External infra only (intentionally deferred)


| Item                                  | Reality                                                                                             |
| ------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **season-stats.json (287MB)**         | Gitignored — exceeds GitHub limit; build locally with `node scripts/seed-external-data.mjs --build` |
| **Transfermarkt archive CSVs**        | Gitignored — place under `sportverse/archive/` locally; not pushed to GitHub                        |
| **Meilisearch hosted sync**           | Local token index ships; optional remote when `MEILI_URL` set                                       |
| **Redis multi-instance rooms**        | Socket.IO + file-backed persistence today                                                           |
| **Clerk auth + Sentry**               | Env hooks; wire when credentials available                                                          |
| **Postgres live views**               | Migrations `002` + `003` ready; static deploy uses JSON bundles                                     |
| **BullMQ ETL automation**             | Manual `scripts/seed-external-data.mjs` + `calibrate-engine.ts`                                     |
| **Commercial Opta/StatsPerform feed** | Business licensing — archive + football-datasets substitute                                         |


## Intentional scope choices

- Single League mode skips LSI bridging by design (§5 addendum)
- Pre-season prediction uses raw OVR only — deliberately superficial vs full sim
- Vanilla TS views (React migration optional, not blocking)
- Decathlon timeline/XI puzzles remain curated multi-sport fixtures
- Draft Pass monetization — business layer, not blocking core loop

## Full-fix paths (remaining)

1. **Event data ingestion** → literal xT/VAEP for Tier-1 leagues
2. `**node scripts/seed-external-data.mjs --build`** → backfill season-stats with `goalsConceded` from archive performances
3. **Meilisearch / Postgres / Redis / Clerk / Sentry** → see external infra table

## Calibration commands

```bash
# From repo root — requires sportverse/archive/ CSVs
node scripts/seed-external-data.mjs --calibration-only
cd sportverse && npx tsx scripts/calibrate-engine.ts --write
npm test
```

Output: `sportverse/packages/sports-db/data/engine-calibration.json` (copied to web `public/data` on build).

## Identity Merge v2 — Phase 1 (resolved 2026-07-20 polish)

| Item | Resolution |
|---|---|
| Compare player picker capped at 400 | **Fixed:** search-as-you-type via `searchPlayers` (full archive, 40 hits) |
| Validation holdout n=40 | **Expanded:** seeded holdout n=200 of 500 cross-league fixtures (honest corpus accuracy; first-40 slice was luckier) |

## Identity Merge v2 — Phase 4 (resolved 2026-07-20)

| Item | Resolution |
|---|---|
| season-stats omit club/team | **Fixed:** ETL writes `clubName`; `enrich-season-stats-clubs.mjs` backfilled ~1.85M rows. Wheel still prefers `club-season-rosters.json`. |
| Mid-list OVR inflation (Okazaki/Govou) | **Fixed:** (1) era-cohort MV percentiles; (2) peak-window min 10 apps — cup-cameo GPG spikes no longer dominate. Top-100 re-audited in `BUILD_LOG_TOP100.txt`. |

## Identity Merge v2 — Phase 5 (resolved 2026-07-20)

| Item | Resolution |
|---|---|
| Lighthouse mobile ≥85 | **Met:** Performance **89** (A11y 97, BP 96, SEO 100) on `/play/sportverse/` — see `BUILD_LOG.md` / `BUILD_LOG_LIGHTHOUSE.json` |
| Candidate perf &lt;50ms | **Met:** median of 5 warmed `getPickCandidates` calls &lt;50ms (poolMap + fame cache) |
