# DRAFTBALLER Build Log

## Phase 1 — Post-draft season simulation

**Built:**
- `@sportverse/match-sim` package: seeded RNG, squad zone strengths, single-match sim (~85 phases), 38-opponent generation, full season sim
- Types: `SimSquadInput`, `SeasonSimResult`, `FixtureResult`, `MatchEvent`, `SavedSquadPayload`
- `draftballer-core/squad-session.ts` — save/load squad for season route
- `draftballer-season.ts` — results UI (38 fixtures, MVP, perfect/unbeaten badges)
- Wired **Simulate Season** from wheel + snake draft complete screens
- Fixed routing: `#/draftballer/wheel`, `#/draftballer/season`, `navigate("draftballer", param)`

**Decisions:**
- Opponents use real rated players from draft pool when pool ≥ 22 (Transfermarkt + WC + curated)
- Match engine tuned for ~1.5–5.5 total goals/game (both teams)
- Commentary uses templated strings (not seeded — cosmetic only)

**Tests:** `match-sim.test.ts` (8), `spin-wheel.test.ts` (3)

---

## Phase 2 — Data layer (ETL + JSON + Postgres seed)

**Built:**
- ETL: `scripts/seed-external-data.mjs`, `scripts/etl/build-from-football-datasets.mjs`, `scripts/etl/build-from-transfermarkt.mjs`
- **football-datasets:** World Cup squads/appearances/goals, Big-5 league clubs + era baselines
- **Transfermarkt (R2 CDN):** 46,380 players, 1.56M appearance rows → 73,943 career stat rows
- **Totals:** 54,812 players, 80,829 stat rows, 245 clubs, 165 era baselines
- `@sportverse/sports-db` lazy-load (`ensureExtendedDataLoaded`) — fetch JSON in browser, import in Node/tests
- Rating v2: `stats-rating.ts` with era filters + league gpg baselines
- API routes: search, stats, competitions, pool-counts, compute-pool, per-player rating
- Postgres: `001_schema.sql`, `seed-data.sql` (50k players / 250k stats cap)

**Decisions:**
- Transfermarkt via HTTPS gzip (Windows-safe; no emoji-path clone)
- JSON bundles committed for Netlify static deploy; API/SQL for dev Postgres path
- Curated quiz players keep hand-verified clues; draft pool uses full ETL set

---

## Phase 3 — Rating explainability

**Built:**
- `draftballer-breakdown.ts` — modal with OVR breakdown, attributes, club/intl stat rows, confidence label
- Click-to-explain on player cards (wheel, season MVP, pool picks)

---

## Phase 4 — Portfolio showcase

**Built:** `stadium-dark.astro`, `brutalist-motion.astro`, `fintech-precision.astro` — showcase index now lists 7 demos

---

## Phase 5 — DRAFTBALLER bible (MVP)

**Built:**
- Daily Draft Challenge (`#/draftballer/daily`) — date-seeded shared mode
- Instant H2H (`#/draftballer/h2h`) — `simulateMatch` vs rival from full pool
- Share result card (canvas PNG + Web Share API)
- Trophy case (localStorage, hub display, season auto-record)
- Hub shows live pool counts from database

**Deferred (documented in KNOWN_SIMPLIFICATIONS.md):**
- Multiplayer WebSocket draft rooms
- Champions League knockout mode

---

## Phase 6 — Archive ETL + Rating Engine v3

**Built:**
- `scripts/etl/build-from-archive.mjs` — streams 92k profiles + 1.88M performances, national stats, transfers
- `scripts/etl/competition-map.mjs`, `scripts/etl/seed-awards.mjs`
- Archive primary in `seed-external-data.mjs` (`--tm-cdn-fallback` optional)
- Outputs: `player-aliases.json`, `awards.json`, `iconic_moments.json`
- Rating v3: `peak-weighting.ts`, `lens-blend.ts`, `awards.ts`, real club/intl OVR split in `compute.ts`
- `rating-v3.test.ts` — bible §14.1 worked example + lens/peak/award tests
- Extended sports-db loader for awards, aliases, moments

**DoD:** Run `node scripts/seed-external-data.mjs --build --import-sql` for ≥85k players.

---

## Phase 6b — Pool performance cache

**Built:**
- `materialized.ts` — in-memory pool cache (15m TTL, mode hash key)
- `scripts/benchmark-pool.mjs` — p95 timing across presets
- API exposes cache stats on `/api/sports/pool-counts` and compute-pool

---

## Phase 7 — Draft Architect + mode matrix

**Built:**
- `mode-filters.ts` — single `buildFilteredPoolInputs` (era, scope, continental, eligibility)
- Architect 4-panel UI (era, competition, eligibility, lens)
- Presets: `single-year-2020`, `continental-cl`, `best-context`
- `POST /api/pool/preview`

---

## Phase 8 — Multiplayer draft rooms

**Built:**
- `draft-room-fsm.ts` + FSM unit tests
- In-memory room store + REST (`/api/draft/rooms/*`)
- Socket.IO attach at `/ws/draft` (`ws.ts`)
- `#/draftballer/mp-lobby`, `#/draftballer/room/:code`

---

## Phase 9 — UCL knockout + squad sharing

**Built:**
- `match-sim/knockout.ts` — single-elimination bracket
- `squad-share.ts` — encode/decode share codes
- `#/draftballer/ucl`, `#/draftballer/import/:code`

---

## Phase 10 — Polish

**Built:**
- Holographic prismatic card shimmer (`prefers-reduced-motion` safe)
- Architect grid layout + hub links for MP/UCL

---

## Phase 11 — Infrastructure

**Built:**
- Daily leaderboard API (`POST /api/daily/score`, enriched `GET /api/daily`)
- Search endpoint documents local index (`engine: local-index`)
- Squad share API stub (`POST /api/squads/share`)

---

## Verification

```powershell
node scripts/seed-external-data.mjs --build --import-sql
cd sportverse && npm test
npm run build -w @sportverse/web
node scripts/benchmark-pool.mjs
```

Play: `#/draftballer`, `#/draftballer/architect`, `#/draftballer/ucl`, `#/draftballer/mp-lobby`, `#/draftballer/room/CODE`

---

## Phase 12 — Simulation Intelligence Engine v2

**Built:**
- Era profiles (`era-profiles.ts`) — 1950s through 2020s + neutral modern
- Player meta: durability, TRI, clutch (`player-meta.ts`)
- Fit model: physicality term, technical ceiling dampener, fatigue toll (`fit-model.ts`)
- `simulateMatchV2()` — momentum, weather, cards, penalties, fit report, commentary v2
- `simulateEraLab()` batch across eras
- `sim-session.ts` — client sim config persistence
- Prime Powers preserves `match-legacy.ts` §7.1 behavior
- Season sim carries fatigue between fixtures (`season.ts`)
- API: `POST /api/squads/:id/simulate`, `POST /api/squads/:id/simulate-era-lab`
- UI: sim setup, era lab, fit report on season/H2H
- Tests: `sim-v2.test.ts`

---

## Phase 13 — Formation System v1

**Built:**
- 13 canonical formations + 3×3 zone grid (`formations.ts`)
- Zone overload modifier in phase resolution
- Squad builder UI with pitch preview
- API: `GET/POST /api/formations`
- Knockout/season/H2H pass formation + tactical identity from squad builder

---

## Final verification (Phases 6–13)

```powershell
cd sportverse && npm test
npm run build -w @sportverse/web
```

Routes: `#/draftballer/squad-builder`, `#/draftballer/sim-setup`, `#/draftballer/era-lab`, `#/draftballer/formation-canvas`

---

## Phase 14 — Rating Engine v4 (EA Benchmark Addendum)

**Built:** micro-coefficients, squad CF, calibration, GK attrs, validation suite, breakdown UI upgrades.

---

## Phase 15 — KNOWN_SIMPLIFICATIONS upgrades

**Built:** token search, persistent API stores, role fit, formation canvas, two-legged UCL, daily leaderboard, position-locked draft helpers.

---

## Phase 16 — LSI v2 + Statistical Rigor Standard

**Built:**
- `lsi-v2.ts` — z-score ensemble, James-Stein shrinkage `n/(n+k)`, connectivity graph, Massey LS toy solver
- `compute-lsi.ts` job wrapping v2 pipeline
- `ovrFromMacroZ` / `attrsFromMacroZ` — fixes pointSwing over-penalization (consistent league-local reference)
- `attribute-confidence.ts` — DEF/GK structural confidence discount (Engine v4 §1.3)

**Tests:** `lsi-v2.test.ts` (9), `lsi-calibration.test.ts` (3), `league-strength.test.ts` (12)

**Decision:** Ensemble weights remain UNCALIBRATED expert prior until held-out fixture fit runs at scale.

---

## Phase 17 — Dixon–Coles Layer 1 + constrained Layer 2

**Built:**
- `dixon-coles.ts`, `team-strength.ts`, `match-rates.ts`, `aggregation-bridge.ts`
- `sim-engine.ts` samples DC score first; phase loop capped at target; `injectRemainingGoals` guarantees final score
- `goalRateModel` on `MatchResultV2`

**Tests:** `dixon-coles.test.ts` (5), `sim-v2.test.ts` (DC target = final goals)

---

## Phase 18 — Validation harness

**Built:** `validation.ts` (RPS, Brier, log-loss), `validate-match-model.ts`, `aggregation-bridge.test.ts`, `validation.test.ts`

**Simplification:** Bridge calibration rows are tier-ordered expert priors — full §3.2 regression needs team-season GF/GA ingestion.

---

## Phase 19 — Season prediction + expectation grading

**Built:**
- `season-prediction.ts` — layman OVR preview + 7-grade verdict (`exceeded` … `underwhelmed`)
- `SeasonSimResult.prediction` + `expectationGrade` types
- Season UI: pre-sim forecast prominent → button → post-sim verdict

**Tests:** `season-prediction.test.ts` (6)

---

## Phase 20 — Comprehensive report UI

**Built:** `draftballer-reports.ts` — prediction panel, verdict compare, enhanced fit report, season analysis; CSS in `draftballer.css`

---

## Final verification (Phases 16–20)

```powershell
cd sportverse && npm test
npm run build -w @sportverse/web
npx tsx scripts/validate-match-model.ts
```

Route: `#/draftballer/season` — preview → simulate → graded report

---

## Final pass — incomplete items

| Item | Why |
|---|---|
| True xT/VAEP/OBV (Tier 1) | No event-level pass/carry data in schema — proxies only |
| Aggregation bridge fit on real team-season GF/GA | Requires team-season goals pipeline |
| Beat RPS 0.2063 benchmark | Directional target only; proxy holdout uses cross-league fixtures |
| Meilisearch / Redis / Clerk / Sentry / live Postgres | External credentials — see KNOWN_SIMPLIFICATIONS |

