# DRAFTBALLER — All Game Modes

**Last updated:** 2026-07-03  
**Hub route:** `#/draftballer`

Every mode below uses the full elite stack: **Rating Engine v3 + LSI v2 bridging**, **Dixon–Coles Layer 1 match backbone**, **constrained Layer 2 event sim**, chemistry/squad rules, and archive-backed player pool (~1.88M season stat rows).

---

## 1. Draft pool axes (how every mode is built)

Modes are **compositions of four filters**, not separate code paths:


| Axis                  | Controls                         | Examples                                                          |
| --------------------- | -------------------------------- | ----------------------------------------------------------------- |
| **Era**               | Which career window counts       | Single year, decade, custom range, all-time (peak-4)              |
| **Competition scope** | Which competitions feed the pool | Any league, single league, continental, international, custom set |
| **Rating lens**       | Club vs international vs blend   | Club-only, international-only, blended slider, best-context       |
| **Eligibility**       | Who is draftable                 | Min apps, nationality, legends-only, position-locked              |


Configure all four in **Draft Architect** (`#/draftballer/architect`). Presets are saved configs over the same engine.

---

## 2. Preset draft modes (9 presets)


| ID                 | Title                 | Era              | Scope              | Lens               | How to play                                          |
| ------------------ | --------------------- | ---------------- | ------------------ | ------------------ | ---------------------------------------------------- |
| `all-time-any`     | All-Time · Any League | All-time peak-4  | Any league         | Club-only          | `#/draftballer/mode/all-time-any` → quick spin wheel |
| `club-only`        | Club Version          | All-time         | Any league         | Club-only          | Ratings from club stats only                         |
| `international`    | International Version | All-time         | International      | International-only | Nations on wheel; intl caps/tournaments only         |
| `premier-league`   | Premier League        | All-time         | Single league (PL) | Club-only          | PL clubs on wheel                                    |
| `decade-2010s`     | 2010s Decade          | 2010s            | Any league         | Blended 35% intl   | Best of the 2010s                                    |
| `single-year-2020` | 2020 Season           | Single year 2020 | Any league         | Club-only          | Snapshot season ratings                              |
| `continental-cl`   | Champions League      | All-time         | Continental        | Club-only          | UCL/UEL pool                                         |
| `best-context`     | Best Context          | All-time         | Any league         | Best-context       | max(club, intl) −2 transparency penalty              |
| `custom`           | Draft Architect       | User-set         | User-set           | User-set           | Full manual control                                  |


---

## 3. Draft format modes


| Format                                     | Route                                 | Players         | Timer                                      | Description                                                                          |
| ------------------------------------------ | ------------------------------------- | --------------- | ------------------------------------------ | ------------------------------------------------------------------------------------ |
| **Spin & Build (Wheel)**                   | `#/draftballer/wheel`                 | Solo            | None                                       | Land on club/nation+era segment; draft XI from filtered pool (38-0 style randomizer) |
| **Snake vs Bot**                           | `#/draftballer/room`                  | 1 human + 1 bot | N/A (instant bot)                          | Standard snake order 1→2→2→1; 11 picks; uses session mode from Architect             |
| **Linear vs Bot**                          | `#/draftballer/room/linear`           | 1 human + 1 bot | N/A                                        | Same pick order every round                                                          |
| **Auction vs Bot**                         | `#/draftballer/auction`               | 1 human + 1 bot | Per lot                                    | Budget bidding on nominated players                                                  |
| **Blind vs Bot**                           | `#/draftballer/blind`                 | 1 human + 1 bot | Per round                                  | Simultaneous hidden picks; conflicts by draft order                                  |
| **Multiplayer Snake/Linear/Auction/Blind** | `#/draftballer/mp-lobby` → room code  | 2–12 humans     | **45s default**, configurable, or no timer | WebSocket authoritative room; auto-pick on timeout; spectator join                   |
| **Position-locked**                        | Architect checkbox → any format above | Any             | Same as format                             | Must fill required positions each round                                              |


**Multiplayer setup:** Host picks format, squad size, drafter count, timer (45s / custom / async none). Share room code. Reconnect keeps timer running; timeout triggers BPA auto-pick.

---

## 4. Daily & challenge modes


| Mode                      | Route                     | Description                                                                                                       |
| ------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Daily Challenge**       | `#/draftballer/daily`     | Date-seeded fixed pool (Wordle-style); everyone drafts same universe today; submit squad OVR to daily leaderboard |
| **Featured preset spins** | `#/draftballer/mode/{id}` | Hub shortcuts (All-Time, PL, International) launch wheel with preset filters                                      |


---

## 5. Post-draft competitive modes

All require a saved squad (from wheel, snake, auction, blind, or MP draft).


| Mode                      | Route                         | Description                                                                      |
| ------------------------- | ----------------------------- | -------------------------------------------------------------------------------- |
| **Squad Builder**         | `#/draftballer/squad-builder` | Formation picker, drag slots, chemistry icons, live squad OVR + CF               |
| **Simulation Conditions** | `#/draftballer/sim-setup`     | Era context, weather, Prime Powers, tactical identity before sim                 |
| **38-Game Season**        | `#/draftballer/season`        | Full league season vs AI squads from real pool; Dixon–Coles scores + event layer |
| **Head-to-Head**          | `#/draftballer/h2h`           | Instant one-off match between two squads                                         |
| **Knockout Cup (UCL)**    | `#/draftballer/ucl`           | 4/8/16 bracket, seeded by squad rating                                           |
| **Mini League**           | `#/draftballer/mini-league`   | Round-robin table with AI opponents                                              |
| **Era Lab**               | `#/draftballer/era-lab`       | Batch-test your XI across reference era profiles                                 |
| **Share Result**          | From season/H2H complete      | Branded 1080×1350 share card + Web Share API                                     |


---

## 6. Meta & retention


| Feature                   | Where                   | Description                                                |
| ------------------------- | ----------------------- | ---------------------------------------------------------- |
| **Trophy Case**           | Hub panel               | localStorage achievements (90+ OVR, mode wins, etc.)       |
| **Career Draft Rank**     | Profile layer           | ELO-style cross-draft rating (platform)                    |
| **Leaderboards**          | API `/api/leaderboards` | Global + daily by mode                                     |
| **Rating Breakdown**      | Tap any player card     | Radar, compare-to, live lens blend, LSI panel, micro table |
| **Pre-season prediction** | Season flow             | Layman expectation before sim; graded after                |


---

## 7. SPORTVERSE quiz modes (same player archive)

Accessible from `#/hub` — all use extended DB + procedural generation:

- Who Am I?, True/False, Speed Round, Career Path, Decathlon puzzles, Football IQ scenarios, Goalkeeper mini-game

---

## 8. Bot personalities (solo & MP fill)


| Bot                  | Behavior                                 |
| -------------------- | ---------------------------------------- |
| **Balanced**         | Fills positional needs evenly            |
| **Star Hunter**      | BPA; front-loads superstars              |
| **Formation Purist** | Locks formation early; drafts to fill    |
| **Nostalgia Bot**    | Era/nationality bias + contextual banter |


---

## 9. Typical session flows

**Quick solo (8–15 min):** Hub → Wheel → draft XI → Season or H2H → Share  
**Full competitive (20–40 min):** Architect → MP Lobby → Snake draft → Squad Builder → Sim Setup → Season/Mini League  
**Daily (5–10 min):** Daily Challenge → Wheel → Submit OVR → Compare leaderboard

---

## 10. Data & engine transparency

- Pool: Transfermarkt archive + World Cup + curated legends (~90k+ players, 1.88M stat rows)
- LSI v2: z-score ensemble, empirical Bayes shrinkage, connectivity — **weights fit on 500 archive fixtures + 8000 transfers**
- Match sim: Dixon–Coles λ/μ → constrained event attribution
- Calibration file: `packages/sports-db/data/engine-calibration.json` (archive-fitted bridge + bridging bounds)