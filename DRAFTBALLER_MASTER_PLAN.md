# DRAFTBALLER — Master Implementation Plan

**Version:** 2.0 (post–Phase 5 audit)  
**Purpose:** Single source of truth for remaining Product Bible implementation.  
**Rules:** Follow [Operating Rules](#operating-rules) at bottom. No stubs, placeholders, or TODO-only deliverables.

---

## 0. Executive Summary

**Done:** Phases 0–5 MVP (wheel, snake, 38-game season, 54k-player ETL, explainability modal, daily/H2H/share/trophies, 7 showcase demos).  
**Critical gap:** Local archive (`sportverse/archive/`) is **not yet ingested** — it contains ~92k player profiles and ~1.88M per-season club performances, richer than current R2 CDN career aggregates.  
**Bible gaps:** Rating engine §4 (awards, peak weighting, best-context lens), Draft Architect §8.2, multiplayer WebSocket §6/§10.5, UCL knockout §7.2, draft formats beyond snake/wheel, squad builder pitch UI, Meilisearch, materialized views, full realism pass.

**North-star targets (user):**

1. Compete in any league/era ever
2. Win Champions League in any year
3. Beat friends’ squads (multiplayer + H2H)
4. **Incredibly realistic** ratings and simulation

---

## 1. Current State Inventory (Do Not Rebuild)

### 1.1 Completed — mark `[DONE]`, extend only where noted


| ID   | Area                              | Evidence                                                                           | Notes                                          |
| ---- | --------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------- |
| D-01 | Monorepo packages                 | `draftballer-types`, `draftballer-core`, `rating-engine`, `match-sim`, `sports-db` | Extend, don’t replace                          |
| D-02 | Spin wheel draft                  | `spin-wheel.ts`, `draftballer-wheel.ts`                                            | Era filter wired; needs archive-backed pool    |
| D-03 | Snake vs bot                      | `draft-room.ts`, `draftballer-room.ts`                                             | Local only; not multiplayer                    |
| D-04 | 38-game season sim                | `match-sim/season.ts`, `draftballer-season.ts`                                     | Real-pool opponents when pool ≥ 22             |
| D-05 | H2H instant match                 | `draftballer-h2h.ts`, `simulateMatch`                                              | Single match only                              |
| D-06 | Daily challenge                   | `draftballer-daily.ts`                                                             | Date-seeded mode; no server leaderboard        |
| D-07 | Share card                        | `draftballer-share.ts`                                                             | Canvas 1080×1350 scale; Web Share API          |
| D-08 | Trophy case                       | `trophy-case.ts`, hub display                                                      | localStorage only                              |
| D-09 | Rating breakdown UI               | `draftballer-breakdown.ts`                                                         | Radar, compare, live blend, LSI panel `[DONE]` |
| D-10 | ETL football-datasets             | `build-from-football-datasets.mjs`                                                 | WC + league clubs + era baselines              |
| D-11 | ETL Transfermarkt R2              | `build-from-transfermarkt.mjs`                                                     | 46,380 TM players; career stat aggregates      |
| D-12 | JSON + SQL dual layer             | `sports-db/data/*.json`, `seed-data.sql`                                           | 54,812 players, 80,829 stats                   |
| D-13 | Lazy data load (web)              | `extended.ts` fetch `/data/*.json`                                                 | ~32 MB JSON at runtime                         |
| D-14 | API sports routes                 | `services/api/server.ts`                                                           | search, stats, compute-pool, rating            |
| D-15 | Portfolio showcase                | 7 pages under `src/pages/showcase/`                                                | Bible item 1 largely met                       |
| D-16 | Preset modes                      | `modes.ts`                                                                         | 9 presets + Architect custom axes `[DONE]`     |
| D-17 | BUILD_LOG + KNOWN_SIMPLIFICATIONS | repo root                                                                          | Update each phase                              |


### 1.2 Known simplifications still true

See `[KNOWN_SIMPLIFICATIONS.md](KNOWN_SIMPLIFICATIONS.md)`. Archive ingestion will resolve several data gaps.

---

## 2. Data Sources — Unified Ingestion Strategy

### 2.1 Source map


| Source                       | Location                                         | Scale                    | Unique value                                              | Current use          |
| ---------------------------- | ------------------------------------------------ | ------------------------ | --------------------------------------------------------- | -------------------- |
| **Curated quiz**             | `sports-db/data/players.json`                    | 64                       | Verified clues                                            | Quiz + draft legends |
| **football-datasets**        | `sportverse/data/raw/football-datasets/` (clone) | WC + 5 leagues           | Era gpg baselines, WC stats                               | ETL `[DONE]`         |
| **Transfermarkt R2 CDN**     | HTTPS gzip                                       | ~37k players, 1.56M apps | Broad TM coverage                                         | ETL `[DONE]`         |
| **Local archive (NEW)**      | `sportverse/archive/*.csv`                       | See §2.2                 | Per-season club + national stats, transfers, market value | **NOT INGESTED**     |
| **Kaggle football-datasets** | `kagglehub` optional                             | Overlap with GitHub      | Supplement only if non-duplicate                          | Not used             |


### 2.2 Archive file inventory (user download)


| File                                                            | ~Rows     | Primary use in ETL                                                                                       |
| --------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------- |
| `player_profiles/player_profiles.csv`                           | 92,672    | Canonical TM identity: name, DOB, citizenship, position, current club                                    |
| `player_performances/player_performances.csv`                   | 1,878,719 | **Per-season club stats** (apps, goals, assists, minutes, competition) — replaces career-only aggregates |
| `player_national_performances/player_national_performances.csv` | 92,702    | International caps/goals by team                                                                         |
| `team_details/team_details.csv`                                 | large     | Club metadata, country, division                                                                         |
| `team_competitions_seasons/team_competitions_seasons.csv`       | 196,378   | Club ↔ competition ↔ season mapping                                                                      |
| `transfer_history/transfer_history.csv`                         | large     | Club history for wheel segments + career paths                                                           |
| `player_market_value/player_market_value.csv`                   | 901,430   | Peak-value proxy for sparse eras                                                                         |
| `player_latest_market_value/player_latest_market_value.csv`     | 69,442    | Active player tier hints                                                                                 |
| `player_injuries/player_injuries.csv`                           | 143,196   | Optional durability signal (PHY)                                                                         |
| `player_teammates_played_with/`                                 | —         | Future chemistry §4.8 (low priority)                                                                     |
| `team_children/team_children.csv`                               | —         | Reserve/youth club graph                                                                                 |


### 2.3 Deduplication & merge rules (canonical player ID)

```
Priority for identity merge:
1. player_id (TM numeric) → canonical id: tm-{player_id}
2. Match curated quiz players by normalizeName(name) → keep curated id, attach tm-{id} alias
3. Match WC players by normalizeName → merge WC intl stats onto TM row if same person
4. Never duplicate rows in players-extended.json for same normalized name + DOB (when available)

Stat row merge:
- Archive player_performances → season-stats rows (context=CLUB, real season_label e.g. "2015-16")
- Archive player_national_performances → season-stats (context=NATIONAL_TEAM)
- football-datasets WC stats → merge where wcId/name match; prefer archive if richer
- Drop duplicate (playerId, seasonLabel, competitionId, context) keeping highest confidence

Club merge:
- team_details + team_competitions_seasons → clubs-extended.json with league/competition_id mapping
- Map TM competition_id (GB1, ES1, CL, etc.) → internal competitionId table
```

### 2.4 Target database size (bible §5.3)


| Milestone           | Players      | Stat rows                           | Competitions |
| ------------------- | ------------ | ----------------------------------- | ------------ |
| Current             | 54,812       | 80,829                              | 6            |
| After archive ETL   | **~90,000+** | **~500k–1.5M** (season granularity) | **40+**      |
| Bible launch target | ~60,000      | millions (partitioned in Postgres)  | ~450         |


Archive ingestion should **exceed** bible player count while keeping JSON deploy strategy (see §2.5).

### 2.5 Deploy strategy (Netlify static)

- **Do not** bundle JSON in JS (fixed in vite build).
- Serve `public/play/sportverse/data/*.json` via fetch.
- Split large files if needed:
  - `players-extended.json` (identity + metadata)
  - `season-stats-index.json` (playerId → byte offset) + chunked stats OR SQLite WASM for client search (Phase 6 option)
- Postgres `seed-data.sql` remains full-fidelity for API/dev.
- PWA precache: exclude data JSON (already required for >2MB files).

---

## 3. Bible Gap Matrix — What Remains

Legend: ✅ Done · ⏸ External infra only (requires hosted credentials)

**Status: Phases 6–17 complete.** All product-bible features below are implemented in code unless marked ⏸.

### 3.1 Vision & pillars (§1)


| Requirement                                   | Status                                                                 |
| --------------------------------------------- | ---------------------------------------------------------------------- |
| Infinite replayability via filter composition | ✅ Draft Architect — era, competition, eligibility, lens, LSI toggle    |
| Ratings people trust + transparent            | ✅ Breakdown modal — radar, compare, live blend, LSI panel, micro table |
| Draft feels alive (timer, snipe, flip)        | ✅ Wheel animation, MP pick events, sound cues, bot banter              |
| Visually iconic (holographic tiers)           | ✅ CSS tier borders + prismatic shimmer                                 |
| Shareable by default                          | ✅ Share card 1080×1350 + squad codes                                   |


### 3.2 Draft modes (§3)


| Mode / axis                                                             | Status                           |
| ----------------------------------------------------------------------- | -------------------------------- |
| Era: single year, decade, custom range, all-time                        | ✅                                |
| Competition: any, single league, continental, international, custom set | ✅                                |
| Rating lens: club, intl, blended, best_context + live slider            | ✅                                |
| Eligibility: min apps, nationality, legends                             | ✅                                |
| Presets A–H + Architect                                                 | ✅ 9 presets                      |
| Snake, linear, auction, blind                                           | ✅                                |
| Position-locked                                                         | ✅ mode flag + squad-rules engine |


### 3.3 Rating engine (§4)


| Component                                          | Status                                 |
| -------------------------------------------------- | -------------------------------------- |
| Position weights, micro layer, era z-score, peak-N | ✅                                      |
| AwardBonus, BigMomentBonus, Longevity, legacy tags | ✅                                      |
| CrossContextSynergyBonus, GK attrs, calibration    | ✅                                      |
| **League Strength Index v1** — bounded bridging    | ✅ Elo + transfer-delta, explainability |
| Squad CF + chemistry + partnership pairs           | ✅                                      |
| Client instant blend on breakdown                  | ✅ lensBlend slider                     |
| Pool cache / materialized presets                  | ✅ in-memory + SQL migration ready      |


### 3.4 Data schema (§5.1)


| Entity                                          | Status                                                |
| ----------------------------------------------- | ----------------------------------------------------- |
| players, season stats, awards, moments, aliases | ✅ JSON bundles                                        |
| legacy_reputation_tags, partnership_pairs       | ✅ seeded JSON                                         |
| era_baselines                                   | ✅ competition-season (position_group optional future) |
| Postgres live views                             | ⏸ migration SQL ready                                 |


### 3.5 Draft mechanics (§6)


| Feature                           | Status                          |
| --------------------------------- | ------------------------------- |
| Lobby, pool preview, MP WebSocket | ✅                               |
| Turn timer 45s + auto-pick        | ✅ server-side                   |
| Bot personalities + banter        | ✅                               |
| Reconnect / spectator             | ✅ read-only join role           |
| Squad rules engine                | ✅ validateSquadAgainstFormation |


### 3.6 Post-draft & competitive (§7)


| Feature                                  | Status |
| ---------------------------------------- | ------ |
| Season, H2H, UCL knockout, mini-league   | ✅      |
| Daily + global leaderboards, squad share | ✅      |
| Sim v2 + formations + commentary         | ✅      |


### 3.7 UI/UX (§8)


| Screen                                               | Status                                       |
| ---------------------------------------------------- | -------------------------------------------- |
| Hub, Architect, draft room, breakdown, squad builder | ✅                                            |
| Formation canvas, sim setup, era lab, UCL            | ✅                                            |
| Sound design                                         | ✅ Web Audio cues                             |
| a11y                                                 | ✅ dialog roles, aria labels (ongoing polish) |


### 3.8 Technical architecture (§10)


| Component                                            | Status                                  |
| ---------------------------------------------------- | --------------------------------------- |
| Vanilla TS views (React optional)                    | ✅ intentional                           |
| Socket.IO rooms + file persistence                   | ✅                                       |
| Token-index search                                   | ✅                                       |
| Meilisearch / Redis / Clerk / Sentry / live Postgres | ⏸ env-gated — see KNOWN_SIMPLIFICATIONS |


### 3.9 Portfolio (bible item 1)


| Demo                           | Status |
| ------------------------------ | ------ |
| 7 showcase pages + DRAFTBALLER | ✅      |
| Micro-interactions + OG meta   | ✅      |


---

## 4. Phased Implementation Roadmap (Remaining Work)

Phases 0–5 in BUILD_LOG are **complete**. Continue from **Phase 6**.

---

### Phase 6 — Archive ETL + Rating Engine v3 (Bible §4, §5)

**Goal:** Ingest `sportverse/archive/`, dedupe with existing sources, rebuild JSON/SQL, upgrade rating formulas to bible fidelity.

#### 6.1 New ETL module

**Create:** `scripts/etl/build-from-archive.mjs`

**Inputs:** All CSVs in `sportverse/archive/`  
**Outputs:** Updated `players-extended.json`, `season-stats.json`, `clubs-extended.json`, `competitions.json`, `era-baselines.json`, new `player-aliases.json`, `awards.json` (minimal seed)

**Steps:**

1. Parse `player_profiles.csv` → base player records (`tm-{id}`)
2. Stream `player_performances.csv` → aggregate to `PlayerSeasonStat` rows with real `season_name`, map `competition_id` → internal id
3. Merge `player_national_performances.csv`
4. Build club graph from `team_details` + `team_competitions_seasons` + `transfer_history` (player.clubs[] ordered by recency)
5. Dedupe against curated (64) and WC-only slugs by normalized name
6. Merge football-datasets WC stats where archive lacks intl data
7. Recompute `era_baselines` from archive aggregates (goals/game per competition-season)
8. Wire into `seed-external-data.mjs --build` pipeline **after** football-datasets, **replace** R2 CDN as primary TM source (keep R2 as fallback flag `--tm-cdn-fallback`)

#### 6.2 Rating engine upgrades

**Files:** `rating-engine/src/stats-rating.ts`, `compute.ts`, new `peak-weighting.ts`, `lens-blend.ts`, `awards.ts`


| Formula (bible)              | Function                                                          |
| ---------------------------- | ----------------------------------------------------------------- |
| §4.3.1 OVR weighted sum      | Already in position-weights                                       |
| §4.3.2 Era z-score + sigmoid | Extend stats-rating with position_group baselines                 |
| §4.3.3 Lens blend + synergy  | `lensBlend()` + synergy bonus                                     |
| §4.5 Peak-N weighting        | `peakWeighting(stats, N=4)` for all-time mode                     |
| §4.3.1 AwardBonus            | `awards.ts` lens-filtered                                         |
| §4.3.1 BigMomentBonus        | `iconic_moments.json` lookup                                      |
| §4.3.1 LongevityAdjustment   | All-time/decade only                                              |
| Best-context lens            | `max(club,intl)-2`                                                |
| Remove intl heuristic        | Delete `clubOvr - 4 + random` in compute.ts when intl stats exist |


#### 6.3 Tests (mandatory)

**Create:** `rating-engine/src/rating-v3.test.ts`

- Hand-calculated worked example matching bible §14.1
- Era normalization: same z-score → same attribute across eras
- Lens blend at b=0, b=1, b=0.35
- Peak weighting changes all-time vs single-year
- Award bonus filtered by lens

#### 6.4 Definition of Done

- `node scripts/seed-external-data.mjs --build --import-sql` succeeds with archive as primary
- Player count ≥ 85,000; stat rows ≥ 400,000
- No duplicate player IDs; aliases file documents merges
- All rating v3 unit tests pass
- `POST /api/ratings/compute-pool` returns in <2s for full pool (measure; optimize in 6b if needed)
- BUILD_LOG Phase 6 entry; KNOWN_SIMPLIFICATIONS updated

---

### Phase 6b — Pool performance & materialized aggregates (Bible §4.7)

**Goal:** p95 pool preview <400ms for 90k players.

- Add `packages/rating-engine/src/materialized.ts` — precompute common preset hashes
- API: cache `compute-pool` responses in memory (Node) with mode hash key
- Optional: Postgres materialized views in `002_materialized_ratings.sql`
- Client: store `clubOvrRaw`/`intlOvrRaw` on `RatedPlayerCard` for instant blend slider

**DoD:** Benchmark script in `scripts/benchmark-pool.mjs` reports p95 <400ms for presets.

---

### Phase 7 — Draft Architect + full mode matrix (Bible §3, §8.2 screen 3)

**Goal:** All four filter axes exposed; presets are JSON configs only.

**Create/extend:**

- `draftballer-types`: `EligibilityFilter`, `CustomEraRange`, `CompetitionSet`
- `draftballer-core/mode-filters.ts` — single `buildFilteredPool(mode, players, stats)`
- `draftballer-architect.ts` — 4-panel UI + blend slider + live preview card
- `modes.ts` — add presets: single-year, continental, la-liga, etc.
- `POST /api/pool/preview` — returns count, top 10, position histogram

**DoD:**

- User can set era decade, single season, competition scope, lens slider, min appearances
- Pool count updates live; preview sheet works
- Wheel + snake consume same filter engine

---

### Phase 8 — Multiplayer WebSocket draft rooms (Bible §6.3, §10.5)

**Goal:** 2–12 human drafters + bots; real-time picks; friend codes.

**Stack (per bible):** Socket.IO + Redis room state on existing Hono API.

**Create:**

- `services/api/src/draft-room/` — FSM §14.2 (`LOBBY → POOL_READY → PICKING → COMPLETE`)
- `services/api/src/ws.ts` — Socket.IO attach to server
- `packages/draftballer-core/src/draft-room-server.ts` — shared validation (port from client draft-room.ts)
- `apps/web/src/views/draftballer-mp-lobby.ts` — create/join room
- `apps/web/src/views/draftballer-mp-room.ts` — full draft room UI §8.2 screen 4
- Redis TTL keys `draft_room:{id}`

**Events:** `pick_request`, `pick_confirmed`, `pick_rejected`, `turn_advance`, `room_complete`, `timer_tick`

**DoD:**

- Two browser tabs same room: pick propagates <200ms
- Disconnect → auto-pick after 45s
- Snake + linear formats in MP
- Unit tests for FSM transitions
- Route: `#/draftballer/room/:code`

---

### Phase 9 — Champions League knockout + tournaments (Bible §7.2, user goals ii–iii)

**Goal:** Post-draft continental knockout; bracket sim; friend squads.

#### 9.1 UCL mode filter

- `competitions.json` includes `champions-league`, `europa-league`, etc.
- Preset mode `continental-cl` — eligibility: players with CL stat rows or club in CL season
- Era filter: user picks season year (e.g. 2019–20)

#### 9.2 Knockout engine

**Create:** `packages/match-sim/src/knockout.ts`

- Inputs: 8/16 squads, seeded by squad OVR
- Single elimination; two-legged optional (config)
- Uses `simulateMatch` per leg
- Output: `KnockoutResult` — bracket tree, finals MVP

**UI:** `draftballer-ucl.ts` — bracket view, round sim, champion trophy

#### 9.3 Friend squads

- Export squad as share code (base64 JSON + checksum)
- Import rival squad for H2H / UCL bracket
- `sessionStorage` + optional API `POST /api/squads/share`

**DoD:**

- Draft XI → enter UCL bracket → win final (simulated)
- H2H vs imported friend squad works
- Trophy records UCL win

---

### Phase 10 — Realism, motion, polish (Bible §7.1 tune, §8.3–8.6, §9)

**Match sim realism:**

- Tune phase probabilities from archive goal rates per competition tier
- Home advantage coefficient from era baselines
- Fatigue/injury optional (archive injuries → PHY modifier)

**UI polish:**

- Holographic tier CSS animations (respect `prefers-reduced-motion`)
- Card flip on pick confirm
- Draft room toasts ("Rival drafted X")
- Stadium ambience toggle (optional audio §8.6)
- Showcase OG tags + nav links in `src/data/site.ts`

**DoD:** Manual playtest checklist; no regressions in tests.

---

### Phase 11 — Infrastructure & retention (Bible §10, §11, §2 meta)

- Meilisearch index sync from `players-extended.json`
- Server daily challenge seed + leaderboard API
- Guest auth → Clerk optional signup at trophy save
- Sentry frontend + API
- Career Draft Rank (ELO) stub → full implementation

---

## 5. File Change Index (by phase)

### Phase 6 — new/modified


| Action | Path                                           |
| ------ | ---------------------------------------------- |
| NEW    | `scripts/etl/build-from-archive.mjs`           |
| NEW    | `scripts/etl/competition-map.mjs`              |
| NEW    | `packages/sports-db/data/player-aliases.json`  |
| NEW    | `packages/sports-db/data/awards.json`          |
| NEW    | `packages/sports-db/data/iconic_moments.json`  |
| MOD    | `scripts/seed-external-data.mjs`               |
| MOD    | `packages/sports-db/src/extended-types.ts`     |
| MOD    | `packages/rating-engine/src/`*                 |
| NEW    | `packages/rating-engine/src/rating-v3.test.ts` |
| MOD    | `KNOWN_SIMPLIFICATIONS.md`, `BUILD_LOG.md`     |


### Phase 8 — new


| Path                                         |
| -------------------------------------------- |
| `services/api/src/draft-room/fsm.ts`         |
| `services/api/src/draft-room/store.ts`       |
| `services/api/src/ws.ts`                     |
| `apps/web/src/views/draftballer-mp-lobby.ts` |
| `apps/web/src/views/draftballer-mp-room.ts`  |
| `apps/web/src/lib/draft-socket.ts`           |


### Phase 9 — new


| Path                                           |
| ---------------------------------------------- |
| `packages/match-sim/src/knockout.ts`           |
| `apps/web/src/views/draftballer-ucl.ts`        |
| `packages/draftballer-core/src/squad-share.ts` |


---

## 6. Verification Matrix (final pass — Operating Rule 10)

Before declaring bible complete, verify each section:


| Bible §        | Verification                                            |
| -------------- | ------------------------------------------------------- |
| §1 Pillars     | Checklist in Phase 10 sign-off                          |
| §2 Core loop   | End-to-end: mode → draft → squad → sim → share → replay |
| §3 All modes   | Architect generates pool for each preset + custom combo |
| §4 Rating      | Unit tests + breakdown shows all bonus components       |
| §5 Data        | 85k+ players, season stats, awards table populated      |
| §6 Draft       | MP room 2-player test + bot solo                        |
| §7 Competitive | 38-season + UCL bracket + H2H                           |
| §8 UI          | All 8 screens exist (see §3.7)                          |
| §9 Graphics    | Tier animations + share card 1080×1350                  |
| §10 Tech       | WS + search + API documented                            |
| §11 Growth     | Daily + share virality                                  |
| §12 Legal      | Disclaimer in app footer                                |
| §13 Roadmap    | This document phases 6–11                               |
| §14 Appendix   | Worked rating example in tests                          |


---

## 7. Commit Plan (Operating Rule 8)


| Commit                                                 | Scope                             |
| ------------------------------------------------------ | --------------------------------- |
| `Phase 6: Archive ETL and rating engine v3`            | ETL + rating + tests + JSON regen |
| `Phase 6b: Pool compute caching and benchmarks`        | API cache + materialized          |
| `Phase 7: Draft Architect and full mode filters`       | UI + mode-filters                 |
| `Phase 8: Multiplayer WebSocket draft rooms`           | Socket.IO + MP UI                 |
| `Phase 9: Champions League knockout and squad sharing` | knockout + UCL UI                 |
| `Phase 10: Realism tuning and visual polish`           | sim tune + CSS/motion             |
| `Phase 11: Search, auth, observability`                | Meilisearch + optional Clerk      |


---

## 8. Operating Rules (binding)

1. Read this plan + relevant bible § before each phase.
2. Work phases **6 → 11 in order**; no skipping.
3. Do not stop for approval between phases unless **blocking** (credentials, plan contradiction).
4. Each phase: build zero errors → unit tests → manual E2E → spec match → no load-bearing TODOs.
5. Rating correctness = highest quality bar; hand-checked expected values in tests.
6. Append `BUILD_LOG.md` after each phase.
7. Document simplifications only in `KNOWN_SIMPLIFICATIONS.md` with full-fix path.
8. One commit minimum per phase.
9. Refactor earlier code in place when later phases require it.
10. Final pass: re-read bible §0–14; list any incomplete items in BUILD_LOG final summary.

---

---

### Phase 12 — Simulation Intelligence Engine v2 (Addendum §0–11)

**Scope:** Era-aware match simulation — draft era ≠ simulation era; fit model; tactical identity; momentum; weather; cards/fatigue; fit report; Era Lab; Prime Powers toggle; multi-match fatigue.

**Built:**

- `packages/draftballer-types/src/sim-types.ts` — `SimMatchConfig`, `EraProfile`, `FitReportLine`, formation types
- `packages/match-sim/src/era-profiles.ts` — 8 launch era profiles + `resolveEraProfile()`
- `packages/match-sim/src/player-meta.ts` — DUR, TRI, clutch temperament
- `packages/match-sim/src/fit-model.ts` — physicality fit, technical dampener, fatigue toll, zone pick
- `packages/match-sim/src/sim-engine.ts` — `simulateMatchV2()` full v2 loop
- `packages/match-sim/src/weather.ts`, `penalties.ts`, `commentary-v2.ts`, `era-lab.ts`
- `packages/match-sim/src/match-legacy.ts` — preserved §7.1 Prime Powers path
- `packages/draftballer-core/src/sim-session.ts` — sim config + squad builder session
- API: `POST /api/squads/:id/simulate`, `POST /api/squads/:id/simulate-era-lab`
- UI: `#/draftballer/sim-setup`, `#/draftballer/era-lab`, fit report on season/H2H
- Tests: `sim-v2.test.ts` — era fit, zone overload, fit report, prime powers

**DoD:** Technical XI penalized in 1970s sim; Prime Powers = legacy behavior; Era Lab batch works; realistic default ON.

**Fast-follow (documented in KNOWN_SIMPLIFICATIONS):** §3–9 partial — mid-match formation change UI, bot rotation AI, custom formation canvas builder.

---

### Phase 13 — Formation System v1 (Addendum §0–6)

**Scope:** 13 canonical formations, 3×3 zone grid, zone overload engine, squad builder UI, API.

**Built:**

- `packages/match-sim/src/formations.ts` — 13 formations, `zonePresence`, `zoneOverloadModifier`, `formationsForEra()`
- Formation overload integrated in `sim-engine.ts` phase resolution
- API: `GET /api/formations`, `POST /api/formations` (custom, in-memory)
- UI: `#/draftballer/squad-builder` — formation grid + tactical identity + pitch preview
- Season/H2H/UCL pass `formationHomeId` from squad builder state

**DoD:** 3-4-3 vs 4-4-2 produces measurable wide overload; formation choice affects sim via geometry.

**Fast-follow:** §2.1 pre-draft formation lock, §4 role fit per slot, custom formation drag canvas.

---

## 10. Verification Matrix (Phases 12–13)


| Addendum §              | Verification                                                          |
| ----------------------- | --------------------------------------------------------------------- |
| Sim v2 §1 Era profiles  | 6 reference decades + neutral modern; `resolveEraProfile()`           |
| Sim v2 §2 Fit model     | DUR/TRI derived; physicality term ±20%; technical dampener on DRI/PAS |
| Sim v2 §10 Prime Powers | Toggle OFF = legacy `match-legacy.ts`; ON = full v2                   |
| Sim v2 §8 Era Lab       | `#/draftballer/era-lab` + `POST .../simulate-era-lab`                 |
| Formation §1.3          | 13 formations in `FORMATIONS` constant                                |
| Formation §3            | `zoneOverloadModifier()` unit test 3-4-3 vs 4-4-2 wide                |
| Formation §2.2          | Squad builder saves formation + syncs sim config                      |


---

## 11. Commit Plan (Phases 12–13)


| Commit                                         | Scope                                                |
| ---------------------------------------------- | ---------------------------------------------------- |
| `Phase 12: Simulation Intelligence Engine v2`  | era profiles, fit model, sim-engine v2, era lab, API |
| `Phase 13: Formation system and zone overload` | formations data, squad builder UI, overload in sim   |


---

*Document maintained at `DRAFTBALLER_MASTER_PLAN.md`. Phases 6–20 complete.*

---

### Phase 16 — LSI v2 + Statistical Rigor Standard (Addendum)

**Scope:** Z-score ensemble, empirical Bayes shrinkage, graph connectivity, Massey toy test, `ovrFromMacroZ` pointSwing fix, UNCALIBRATED labels.

**DoD:** `lsi-v2.test.ts`, `lsi-calibration.test.ts`, `league-strength.test.ts` pass; `compute-lsi.ts` job runs.

**Status:** ✅ Complete

---

### Phase 17 — Real-World Grounded Engine v4 Layer 1 (Dixon–Coles)

**Scope:** `dixon-coles.ts`, `team-strength.ts`, `match-rates.ts`, Layer 2 constrained to DC score in `sim-engine.ts`.

**DoD:** `dixon-coles.test.ts`, `sim-v2.test.ts` (target goals match final score) pass.

**Status:** ✅ Complete

---

### Phase 18 — Aggregation bridge + validation harness

**Scope:** `aggregation-bridge.ts` regression fit, `validation.ts` (RPS/Brier/log-loss), `validate-match-model.ts` script.

**DoD:** `aggregation-bridge.test.ts`, `validation.test.ts` pass; benchmark reference documented.

**Status:** ✅ Complete (bridge rows = UNCALIBRATED expert prior until team-season GF/GA fit)

---

### Phase 19 — Season prediction + expectation grading

**Scope:** `season-prediction.ts`, pre-sim preview UI, post-sim verdict (7 grades), types on `SeasonSimResult`.

**DoD:** `season-prediction.test.ts` pass; `#/draftballer/season` shows preview before sim button.

**Status:** ✅ Complete

---

### Phase 20 — Comprehensive report UI

**Scope:** `draftballer-reports.ts`, enhanced fit report, season analysis block, CSS report panels.

**DoD:** Season/H2H/Era Lab use shared report renderer; conversational + report-style copy.

**Status:** ✅ Complete

---

## 12. Immediate Next Action

Phases 6–20 complete. Run full verification:

```powershell
cd sportverse && npm test
npm run build -w @sportverse/web
npx tsx scripts/validate-match-model.ts
```

Play: `#/draftballer/season` (pre-sim preview → run sim → verdict report)