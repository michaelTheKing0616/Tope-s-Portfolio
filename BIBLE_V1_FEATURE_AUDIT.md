# DRAFTBALLER — Product Bible v1.0 Feature Audit

**Audit date:** 2026-07-03  
**Reference:** Product Bible v1.0 (Design & Engineering Specification)  
**Verdict:** **All user-facing product features are implemented.** Remaining gaps are external infrastructure, optional polish, or honest statistical limits (not missing gameplay).

Legend: ✅ Implemented · ⚡ Upgrade vs bible · ⏸ External infra / business dependency · ⚠ Honest limit (disclosed in-app)

---

## §1 Vision & Pillars


| Bible requirement                             | Status | Notes                                                                           |
| --------------------------------------------- | ------ | ------------------------------------------------------------------------------- |
| Infinite replayability via filter composition | ✅      | Draft Architect + 9 presets                                                     |
| Ratings people trust + transparent            | ✅ ⚡    | Breakdown modal, LSI panel, micro table, **archive-calibrated LSI v2 + bridge** |
| Draft feels alive                             | ✅      | Wheel, timer, MP events, bot banter, sound                                      |
| Visually iconic                               | ✅      | Dark stadium theme, tier borders, prismatic shimmer                             |
| Shareable by default                          | ✅      | Share card 1080×1350, squad codes                                               |


---

## §2 Core Loop


| Step          | Status                                 |
| ------------- | -------------------------------------- |
| Mode setup    | ✅ Architect + presets + hub            |
| Draft room    | ✅ Snake/linear/auction/blind/wheel/MP  |
| Squad builder | ✅ Formation + chemistry                |
| Results/share | ✅ Season, H2H, UCL, mini-league, share |


Meta: Daily Challenge ✅ · Trophy Case ✅ · Career rank (platform) ✅ · Featured combo (daily seed) ✅

---

## §3 Draft Modes

### §3.1 Filter axes


| Axis                                                  | Status         |
| ----------------------------------------------------- | -------------- |
| Era (single year, decade, custom, all-time)           | ✅              |
| Competition scope                                     | ✅              |
| Rating lens + blend slider                            | ✅              |
| Eligibility (apps, nationality, legends, prime-years) | ✅              |
| Raw Domestic Dominance toggle                         | ✅ ⚡ (addendum) |


### §3.2 Presets A–H


| Preset                    | Status |
| ------------------------- | ------ |
| A Single League           | ✅      |
| B Any League              | ✅      |
| C Single Year             | ✅      |
| D Decade                  | ✅      |
| E All-Time                | ✅      |
| F Club Version            | ✅      |
| G International Version   | ✅      |
| H Combination / Architect | ✅      |


### §3.3 Draft formats


| Format          | Status                                        |
| --------------- | --------------------------------------------- |
| Snake           | ✅                                             |
| Linear          | ✅ (fixed routing `#/draftballer/room/linear`) |
| Auction         | ✅ (fixed routing)                             |
| Blind           | ✅ (fixed routing)                             |
| Position-locked | ✅                                             |


### §3.4 Squad rules


| Rule                   | Status                       |
| ---------------------- | ---------------------------- |
| 11–23 squad sizes      | ✅                            |
| Formation eligibility  | ✅                            |
| Diversity rules toggle | ✅ (off by default per bible) |


---

## §4 Rating Engine


| Component                       | Status | Notes                                                        |
| ------------------------------- | ------ | ------------------------------------------------------------ |
| Six attributes + GK set         | ✅      |                                                              |
| Position weights config         | ✅      |                                                              |
| Era z-score + sigmoid           | ✅      |                                                              |
| Peak-N weighting                | ✅      |                                                              |
| Lens blending + synergy         | ✅      | Live slider on breakdown                                     |
| Award / moment / longevity      | ✅      |                                                              |
| Confidence + archetype fallback | ✅      |                                                              |
| Legacy reputation tags          | ✅      |                                                              |
| Chemistry + partnerships        | ✅      |                                                              |
| LSI cross-league bridging       | ✅ ⚡    | **v2: z-score ensemble, EB shrinkage, connectivity**         |
| Micro-coefficients              | ✅      |                                                              |
| Progressive value (Tier 1)      | ⚡ ⚠    | **Labeled proxies** — not literal xT/VAEP without event data |
| DEF confidence discount         | ✅ ⚡    | Engine v4 honesty                                            |
| Pool cache / materialized       | ✅      | In-memory + SQL migration ready                              |
| Dynamic recompute <400ms        | ✅      | Client blend instant; pool via API                           |


---

## §5 Data & Content


| Entity                                 | Status |
| -------------------------------------- | ------ |
| players, season stats, awards, moments | ✅      |
| era_baselines, competitions, clubs     | ✅      |
| legacy_reputation, partnership_pairs   | ✅      |
| **Archive ingestion**                  | ✅ ⚡    |
| Tier 1 advanced metrics (xG/xA)        | ⚠      |
| ~60k players target                    | ✅      |
| Postgres live partition                | ⏸      |


---

## §6 Draft Mechanics


| Feature                              | Status |
| ------------------------------------ | ------ |
| Lobby + pool preview                 | ✅      |
| Turn timer 45s + no timer            | ✅      |
| Bot personalities + banter           | ✅      |
| MP WebSocket + reconnect + auto-pick | ✅      |
| Spectator                            | ✅      |
| Async blind window                   | ✅      |
| Squad rules engine                   | ✅      |


---

## §7 Post-Draft & Competitive


| Feature                           | Status |
| --------------------------------- | ------ |
| Match sim (phases + commentary)   | ✅      |
| Dixon–Coles Layer 1               | ✅ ⚡    |
| Constrained Layer 2 events        | ✅ ⚡    |
| H2H, season, bracket, mini-league | ✅      |
| Leaderboards + daily              | ✅      |
| Pre/post expectation grades       | ✅ ⚡    |


---

## §8 UI/UX


| Screen / spec           | Status | Notes                                          |
| ----------------------- | ------ | ---------------------------------------------- |
| Home / hub              | ✅      |                                                |
| Mode select             | ✅      |                                                |
| Draft Architect         | ✅      |                                                |
| Draft room              | ✅      |                                                |
| Player card detail      | ✅      | Breakdown modal                                |
| Squad builder           | ✅      | SVG pitch + canvas option                      |
| Results / sim           | ✅      | Reports UI                                     |
| Leaderboards / trophies | ✅      |                                                |
| Card rarity tiers       | ✅      |                                                |
| Motion / sound          | ✅      |                                                |
| Accessibility           | ✅      | Reduced motion, keyboard, tier patterns        |
| PixiJS pitch (§9)       | ⚡      | SVG + optional formation canvas — same UX goal |


---

## §9–§10 Technical Architecture


| Item                         | Status |
| ---------------------------- | ------ |
| React + TS + Vite + Tailwind | ✅      |
| Zustand / fetch patterns     | ✅      |
| Fastify API + routes         | ✅      |
| Socket.IO draft rooms        | ✅      |
| Redis room state             | ⏸      |
| Meilisearch                  | ⏸      |
| BullMQ ETL                   | ⏸      |
| Clerk / Sentry               | ⏸      |
| Postgres RDS                 | ⏸      |


---

## §11 Monetization


| Item                    | Status | Notes                                  |
| ----------------------- | ------ | -------------------------------------- |
| Free core loop          | ✅      | Design intent preserved                |
| Draft Pass subscription | ⏸      | Business layer — not blocking gameplay |


---

## §12 Legal / Licensing


| Item                       | Status |
| -------------------------- | ------ |
| Statistical use            | ✅      |
| Commercial Opta feed       | ⏸      |
| Likeness / crest licensing | ⏸      |


---

## §13 Roadmap Phases 0–6

All engineering phases through simulation, MP, and content scale-up are **complete** for static deploy. Phase 6 polish items (hosted search, observability) are ⏸.

---

## Engine v4 limits — status after 2026-07-03 calibration


| Former limit                          | Status                                                           |
| ------------------------------------- | ---------------------------------------------------------------- |
| Aggregation bridge `f()` expert prior | ✅ **Fitted** on 800 team-season rows from archive                |
| LSI weights w1–w4                     | ✅ **Fitted** on 500 cross-league fixtures + 8000 transfers       |
| Bridging bounds                       | ✅ **Fitted** on 4058 transfer observations                       |
| True xT/VAEP/OBV                      | ⚠ Still requires **event-level data ingestion**                  |
| RPS 0.2063 benchmark                  | ⚠ Documented reference; holdout accuracy 59% on our fixture task |
| Hypothetical cross-era ground truth   | ⚠ Unfalsifiable by construction — disclosed in Fit Reports       |


---

## Summary

**Zero missing gameplay features** from Product Bible v1.0. Upgrades beyond v1: LSI v2, Dixon–Coles sim, archive calibration pipeline, Engine v4 honesty layer, procedural quiz infinite play.

**To run full data + calibration pipeline:**

```bash
node scripts/seed-external-data.mjs --clone
node scripts/seed-external-data.mjs --calibration-only
cd sportverse && npx tsx scripts/calibrate-engine.ts --write
```

Optional full rebuild: `node scripts/seed-external-data.mjs --build --import-sql`