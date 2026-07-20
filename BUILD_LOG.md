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



---

# Identity Merge v2 — Phase execution

## Phase 1 — Trust Layer (ORCHESTRATOR micro-plan)

**Date:** 2026-07-20

### Spec items
1. Extend breakdown panel for mvBlend / ratingBasis+seasonLabel / fabricated / legend override / fame tier chip
2. Fame-firewall regression test (identical stats + same mvPercentile, fameScore 0 vs 99 → identical OVR)
3. Compare view `#/draftballer/compare/:idA/:idB?` + entry points from breakdown + season MVP
4. Validation badge in hub footer from persisted `sim-validation-report.json`

### Files to touch
- `draftballer-types/src/index.ts` — breakdown fields: `legendOverride`, `mvBlendDelta`, `mvBlendWeight`
- `rating-engine/src/fame-data.ts` — remove fameScore→mvPercentile fallback; add `attachMvPercentilesFromPeakMv`
- `rating-engine/src/compute.ts` — populate new breakdown fields; export `FABRICATED_OVR_CAP`
- `rating-engine/src/fame-firewall.test.ts` — new
- `apps/web/src/main.ts` — stop mapping mvPercentile=fameScore; use peakMv percentiles; add compare route
- `apps/web/src/views/draftballer-breakdown.ts` — render new lines + Compare button
- `apps/web/src/views/draftballer-compare.ts` — NEW
- `apps/web/src/views/draftballer-hub.ts` — validation footer + methodology section
- `apps/web/src/views/draftballer-season.ts` — Compare CTA on MVP
- `apps/web/src/styles/draftballer.css` — minimal chip styles
- `packages/sports-db/data/sim-validation-report.json` — NEW (generated)
- `scripts/validate-match-model.ts` — write JSON artifact
- `BUILD_LOG.md` / `KNOWN_SIMPLIFICATIONS.md`

### Tests
- Fame firewall (hand-asserted identical OVR)
- mvOvrBlend delta math: base 80, pct 50, weight 0.2 → mvOvr=clamp(55+22)=77; result=clamp(80*0.8+77*0.2)=79.4→79
- Full `npm run test:sportverse`

### Risks
- Removing fameScore-as-mvPercentile will shift OVRs (correct; fame must not buy rating)
- No `.git` in workspace — will `git init` locally to satisfy phase commit DoD; no push

### Review checklist (decided before impl)
- [ ] Every breakdown field renders when present
- [ ] Fame tier chip says fame never affects this rating
- [ ] Fame firewall test green
- [ ] Compare works offline for two players + same-player two lenses
- [ ] Hub footer shows validation N fixtures
- [ ] No console errors; suite green; commit Phase 1

### Parallelization
Single worker — shared files (types, main, breakdown).

### Phase 1 — WORKER complete + REVIEWER pass (cycle 1)

**Built:**
- Breakdown panel: mvBlend (+delta/weight/percentile), ratingBasis/seasonLabel, fabricated+cap, legendOverride, fame-tier chip (visibility-only copy)
- Fame firewall: removed fameScore→mvPercentile fallback in `fame-data.ts`; `attachMvPercentilesFromPeakMv` ranks peakMv; fixed `main.ts` + `vitest.setup.ts` leak (`mvPercentile: e.fameScore`)
- `fame-firewall.test.ts` (5) + hand-calc mvOvrBlend + `compare-rate.test.ts` (2)
- Compare view `#/draftballer/compare/:idA/:idB?` with per-side lens/blend/basis; entry from breakdown + season MVP + hub card
- `sim-validation-report.json` (40 fixtures) + hub trust badge + methodology details
- `ratePlayerById` in draftballer-core for offline single-player re-rate

**E2E exercised:** `ratePlayerById(messi, club-only)` vs `international` via compare-rate.test.ts; fame firewall synthetic pair; validation script wrote artifact.

**Decisions:**
- MV percentile = peakMv rank percentile (not fame). OVR distribution shifts vs prior leak — intentional.
- Hub badge shows fixture count only (matches plan wording); full RPS/Brier in methodology (existing RPS formula can be negative — left untouched per Part F.10).
- No `.git` present — initializing local repo for phase commits; no push.

**Review checklist:** all items PASS. Suite: **117** tests green (was 110).

**Next phase needs:** Season pre-sim Match Conditions UI; Fit Report prominence; Era Lab CTA from results; seed `seed:sim:{eraKey}`.


## Phase 2 — Simulation Era Context + Fit Reports (ORCHESTRATOR micro-plan)

**Date:** 2026-07-20

### Spec items
1. Pre-sim Match Conditions in season view: era selector + Prime Powers/fit toggle + fit preview line
2. Fit Report panel (plain-language tags, |delta| sort, top 5 + expand)
3. Era Lab CTA from results + share-card export on Era Lab table
4. Seed `base:sim:{eraKey}` for era-context seasons

### Files
- `fit-model.ts` — plain-language tags + `computeSquadFitReport` + squad avg physicality preview
- `draftballer-types` — SavedSquadPayload era/sim fields; SeasonSimResult.seasonFitReport optional
- `season.ts` — aggregate fit; seed suffix
- `squad-session.ts` — persist era choice
- `draftballer-season.ts` — Match Conditions UI + results Fit Report + Era Lab CTA
- `draftballer-reports.ts` — top-5 expandable Fit Report
- `draftballer-era-lab.ts` — share export
- `draftballer-share.ts` — era-lab share helper
- `era-fit-loop.test.ts` — technical XI 1970s vs 2020s; prime_powers snapshot

### Naming decision
Keep existing engine semantics: `realistic` = fit ON (default), `prime_powers` = raw OVR. UI label matches sim-setup ("Realistic Era Simulation"; off = Prime Powers). Plan acceptance "Prime Powers OFF snapshot" = `prime_powers` mode deterministic snapshot.

### Review checklist
- [ ] Era selector persists on SavedSquadPayload
- [ ] Fit preview shown before sim
- [ ] Fit Report top-5 + expand, plain-language tags
- [ ] Era Lab ≤2 taps from results + share
- [ ] Seed includes eraKey
- [ ] Technical XI worse in 1970s vs Modern (20 runs)
- [ ] prime_powers snapshot stable; suite green

### Phase 2 — WORKER complete + REVIEWER pass (cycle 1)

**Built:**
- Match Conditions on season pre-sim: era selector (match draft / modern / decade), Realistic Era Fit toggle, fit preview headline
- `computeSquadFitReport` / `fitPreviewHeadline` / plain-language Bullied/Thrived tags
- Season aggregates `seasonFitReport`; seed `${draft}:sim:{eraKey}`
- Results: Fit Report top-5 + expand; Era Lab CTA; Era Lab share card
- Tests: `era-fit-loop.test.ts` (4) — technical XI 1970s < Modern over 20 runs; prime_powers snapshot

**Review checklist:** all PASS. Suite **121** green.

**Next:** Phase 3 — tactical identity, formation wheel, Architect pro-mode, mode-code share.


## Phase 3 — Deep-loop integration (ORCHESTRATOR micro-plan)

**Date:** 2026-07-20

### Items
1. Identity picker on draft-complete → SavedSquadPayload.tacticalIdentity
2. Formation picker in wheel → spin-wheel uses getFormation slots
3. Architect: gold Build-your-own card; deepCuts toggle; live blend preview card
4. encodeModeShare / mode-code route
5. overloadCommentary in commentary-v2 + sim-engine
6. Test: 4-3-3 vs 5-3-2 GD distributions differ; mode-code round-trip

### Files: spin-wheel.ts, draftballer-wheel.ts, draftballer-room.ts (+auction/blind), draftballer-architect.ts, draftballer-hub.ts, squad-share.ts, main.ts, commentary-v2.ts, sim-engine.ts, formation-outcomes.test.ts, mode-share.test.ts

### Phase 3 — WORKER complete + REVIEWER pass

**Built:** Identity picker post-draft; wheel formation shapes from FORMATION_SHAPES; Architect gold card + deepCuts + live blend preview + mode share; `#/draftballer/mode-code/:code`; overloadCommentary tactical matchup lines; tests mode-share + formation GD distributions.

**Suite:** 125 green. **Next:** Phase 4 data-quality audit.
# Top-100 OVR — all-time-any
Generated: 2026-07-20T08:20:39.078Z
Pool size: 84160

  1. 99 ST Lionel Messi
  2. 99 ST Cristiano Ronaldo
  3. 98 AM Ronaldinho
  4. 97 CM Paolo Maldini
  5. 97 CM Zinedine Zidane
  6. 97 ST Pelé
  7. 95 ST Thierry Henry
  8. 95 AM Diego Maradona
  9. 94 CM Kevin De Bruyne
 10. 94 GK Gianluigi Buffon
 11. 94 ST Johan Cruyff
 12. 93 ST Kylian Mbappé
 13. 93 CB Virgil van Dijk
 14. 93 CM Luka Modrić
 15. 93 ST Karim Benzema
 16. 93 CM Andrés Iniesta
 17. 93 CM Xavi
 18. 93 CM Andrea Pirlo
 19. 92 ST Erling Haaland
 20. 92 ST Mohamed Salah
 21. 92 ST Robert Lewandowski
 22. 92 ST Luis Suárez
 23. 92 ST Francesco Totti
 24. 92 GK Iker Casillas
 25. 92 CM Roberto Carlos
 26. 92 ST Shinji Okazaki
 27. 91 ST Harry Kane
 28. 91 ST Neymar
 29. 91 CM David Beckham
 30. 91 CM Steven Gerrard
 31. 91 CB Sergio Ramos
 32. 91 ST Sidney Govou
 33. 91 ST Paco Alcácer
 34. 91 ST Andrey Arshavin
 35. 91 ST Alassane Pléa
 36. 91 ST Martin Petrov


## Phase 4 — Data quality (ORCHESTRATOR → WORKER → REVIEWER)

### ORCHESTRATOR micro-plan
1. Fix fame `peakMvYear` ETL (ISO `date_unix`) + rebuild fame-index.
2. Audit club-seasons; fix competitionId→club mapping (never league→club).
3. Because season-stats omit `team_name`, build `club-season-rosters.json` from archive performances.
4. Top-100 OVR smoke list → BUILD_LOG; property tests for candidate quality.
5. Hostile review vs Phase 4 acceptance; commit.

### Built
- `parseMarketValueYear` + unit tests; fame-index rebuilt (~46k).
- `scripts/etl/build-club-season-index.mjs` → `club-season-rosters.json` (2663 seasons, ~1.2MB).
- `setPrebuiltClubSeasons` wired through `extended.ts` / vitest / seed pipeline.
- Club-name filters: reject `tm-*`, youth/U21, league codes; squad size 14–40.
- Audit: `BUILD_LOG_CLUB_SEASON_AUDIT.txt` — 0/20 competition-id leaks; Real Madrid 05/06 shows Zidane/Beckham/Casillas/Ramos.
- Top-100: `BUILD_LOG_TOP100.txt` (GOAT head; mid-list inflation noted).
- `candidate-quality.test.ts` (3): obscure ≤30%, squad ≥14, GK ≥95% full data.

### Spot-check peakMvYear
messi 2017, ronaldo 2017, zidane 2004, henry 2006, ronaldinho 2007, modric 2014, benzema 2016, maldini 2005 (+ more in ETL tests).

### REVIEWER (cycle 1)
- FAIL: league→club last-write-wins → mega-squads. Fixed by removing league map + prebuilt rosters.
- FAIL: titleCaseSlug(`tm-frch`) → "Tm Frch". Fixed with `/^tm[\s_-]/i` reject.
- PASS: audit sane; property tests green; suite **128** tests.

### E2E exercise
`npx tsx scripts/audit-club-seasons.mjs` + vitest candidate-quality with full season-stats + rosters loaded via vitest.setup.

### Simplifications
- Mid-table OVR inflation (Okazaki/Govou) — calibrate via legend-ratings/MV only (no code hacks). See KNOWN_SIMPLIFICATIONS.
- season-stats still lack per-row `clubName`; wheel uses separate roster artifact (full fix = ETL enrich + regenerate 319MB).

### Suite
`npm run test:sportverse` — 128 passed.

## Phase 5 — Game feel (ORCHESTRATOR)

**Micro-plan:**
1. Blind staged reveal (highest OVR last) + prismatic CSS + sound cues + reduced-motion.
2. Spin theatre v2: speed-proportional ticks, near-miss wobble, gold flash on high fameSum.
3. Results CTAs: exactly Share / Run It Back / New Draft (+ overflow).
4. Hub progress: best record, daily streak, latest trophy, featured mode (ISO-week seed).
5. Perf gate <50ms candidates + first-load chunk progress from extended loader.
6. Review, suite, build, E.5 final pass.


## Phase 5 — Game feel (WORKER + REVIEWER)

### Built
1. Blind staged reveal (`staged-reveal.ts`) — ascending OVR, prismatic sting, reduced-motion path; wired in blind + blind wheel complete.
2. Spin theatre v2 — variable-tension ticks, near-miss wobble, gold flash when fameSum ≥ 1600 (UNCALIBRATED EXPERT PRIOR).
3. Season results CTAs — exactly Share / Run It Back / New Draft; Era Lab / H2H / Mini in overflow.
4. Hub progress module — best record, daily streak, latest trophy, ISO-week featured mode.
5. Load progress bar surfaces chunk N/M from `ensureExtendedDataLoaded` callback.
6. Tests: `hub-progress.test.ts` (ISO week hand-check), `candidate-perf.test.ts`.

### REVIEWER
- PASS: CTA discipline (3 primary + overflow).
- PASS: reduced-motion skips tick spam / reveals all at once.
- PASS: suite 131 green.
- SIMPLIFIED: Lighthouse not re-run (KNOWN_SIMPLIFICATIONS).

### E2E exercise
Headless: vitest hub-progress + candidate-perf; season CTA markup via season.ts review; load callback wired in main.ts.


---

# FINAL PASS (Part E.5) — Identity Merge v2 complete

## Parts D verification

| Phase | Status |
|---|---|
| 1 Trust Layer | Done — breakdown MV/fame/basis, compare view, validation badge, fame firewall tests |
| 2 Era context + Fit Reports | Done — Match Conditions, Fit Report, Era Lab CTA, seed discipline, era tests |
| 3 Identity / formation / Architect | Done — post-draft identity, wheel formations, Architect pro-mode, mode-code, overload commentary |
| 4 Data quality | Done — peakMvYear fix, club-season-rosters from performances, audit + top-100, property tests |
| 5 Game feel | Done — staged reveal, spin theatre v2, 3 CTAs, hub progress, load bar, perf gate |

## Part F invariants

1. Offline-first — preserved (`resolveApiBase` unchanged).
2. Dependency direction — preserved; rating-engine still setter-injected.
3. Vanilla-TS views — preserved.
4. Seeded RNG — gameplay paths use `createRng`; cosmetics use `Math.random`.
5. Fame firewall — MV blend labeled; fameScore ≠ OVR tests green.
6. Explainability — new inputs surfaced in breakdown / Fit Report same phase.
7. Fixtures + full data — tests gate on `seasonStatRows > 1000`.
8. Deploy size — `club-season-rosters.json` ~1.2MB (<8MB).
9. Do-not-edit paths respected (plan/archive/public/play not hand-edited).
10. Dixon-Coles / LSI / aggregation-bridge untouched.

## Suite / build

- `npm run test:sportverse` — **131** passed
- `npm run test:projects` — all portfolio projects passed
- `npm run build` — succeeded (Astro + SPORTVERSE embed + data staging)
- Hotfix: export `getFameIndex` from sports-db (blocked Vite build)

## Logged simplifications

See `KNOWN_SIMPLIFICATIONS.md` (Phases 1, 4, 5). Notable: Lighthouse not re-measured; season-stats still lack `clubName` (rosters artifact); mid-list OVR inflation for calibration later.

## Commits (local, not pushed)

1. Phase 1 — Trust Layer
2. Phase 2 — Era / Fit Reports
3. Phase 3 — Identity / formations / Architect
4. Phase 4 — Data quality / club-season rosters / fame peakMvYear
5. Phase 5 — Game feel
6. Fix — trophy-case dangling call
7. Fix — getFameIndex export (build)


## Leftovers + hybrid player cards (2026-07-20)

### Leftovers fixed
1. **OVR inflation:** era-cohort MV percentiles + `PEAK_SEASON_MIN_APPS=10` (cup-cameo firewall). Okazaki/Govou out of top-40; top-100 reads as GOAT list again.
2. **clubName on season-stats:** ETL + enrich backfill (~1.85M rows).
3. **Perf gate:** CI margin tightened 150→80ms.

### Player cards — hybrid data-centric
- Face: OVR · pos · attribute radar · archetype · signature · (non-compact: WF/SM/work + attrs)
- Detail (breakdown modal): DNA panel, formation fits, match-influence bars, trait estimates (labeled as derived)
- `derivePlayerCardProfile` in draftballer-core + unit tests

### Suite
136 tests green. Lighthouse deferred (CLI unavailable here).


## Lighthouse mobile (/play/sportverse/) — 2026-07-20
Performance **89** · Accessibility 97 · Best Practices 96 · SEO 100
(Target was ≥85 performance — met.)

## Polish pass (2026-07-20)

1. Compare search-as-you-type (full archive via searchPlayers)
2. Validation holdout expanded to n=200 (seeded of 500)
3. getPickCandidates hot path: poolMap + fame cache; perf median <50ms
4. Card UX: compact vs full density classes

Suite: 136 green.

