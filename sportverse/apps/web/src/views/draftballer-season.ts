import type { SeasonSimResult, SimMatchConfig, SimSquadInput } from "@sportverse/draftballer-types";
import {
  buildDraftPool,
  loadSimConfig,
  loadSquadBuilderState,
  loadSquadForSeason,
  patchSquadSimConditions,
  ratePlayerById,
  ratePlayerByIdForSeason,
  recordSeasonProgress,
  recordSeasonTrophies,
  saveSimConfig,
} from "@sportverse/draftballer-core";
import {
  fitPreviewHeadline,
  generateHistoricalOpponents,
  generateOpponents,
  getEraProfile,
  getFormation,
  listEraProfiles,
  predictSeasonOutlook,
  resolveEraProfile,
  simulateMatchV2,
  simulateSeason,
} from "@sportverse/match-sim";
import { listSimChallengers, parseSeasonStartYear } from "@sportverse/sports-db";
import { bindPlayerCardBreakdownsWithPool } from "./draftballer-breakdown.js";
import { buildShareCardDataUrl } from "./draftballer-share.js";
import type { RatedPlayerCard } from "@sportverse/draftballer-types";
import { pitchSurfaceHtml } from "./draftballer-pitch.js";
import {
  renderFitReportHtml,
  renderSeasonAnalysisHtml,
  renderSeasonPredictionHtml,
} from "./draftballer-reports.js";

/** Bust stale PWA caches — bump when season results UX changes. */
const SEASON_UI_BUILD = "elite-v1";

type Navigate = (route: string, param?: string) => void;

function seasonFinishLabel(points: number): { label: string; tier: string } {
  if (points >= 85) return { label: "Champions material", tier: "champions" };
  if (points >= 70) return { label: "Title race", tier: "title" };
  if (points >= 60) return { label: "European spots", tier: "europe" };
  if (points >= 45) return { label: "Mid-table", tier: "mid" };
  if (points >= 35) return { label: "Relegation scrap", tier: "scrap" };
  return { label: "Relegated", tier: "relegated" };
}

function renderKeyMomentsHtml(
  fixtures: SeasonSimResult["fixtures"],
  maxItems = 12,
): string {
  const moments: { matchday: number; text: string; isLoss: boolean }[] = [];
  for (const f of fixtures.filter((fx) => fx.result === "L" || fx.goalsFor >= 3)) {
    for (const e of f.events.filter((ev) => ev.type === "goal")) {
      moments.push({ matchday: f.matchday, text: e.text, isLoss: f.result === "L" });
      if (moments.length >= maxItems) break;
    }
    if (moments.length >= maxItems) break;
  }
  if (!moments.length) return "";

  return `
    <section class="panel db-report db-post-moments">
      <p class="db-label-caps">Key Moments Report</p>
      <ul class="db-timeline">
        ${moments
          .map(
            (m) =>
              `<li class="db-timeline-item">
                <span class="db-timeline-dot${m.isLoss ? " db-timeline-dot--loss" : ""}" aria-hidden="true"></span>
                <div class="db-glass db-timeline-card">
                  <p class="db-timeline-card__text">${m.text}</p>
                  <p class="db-timeline-card__meta">Matchday ${String(m.matchday).padStart(2, "0")}</p>
                </div>
              </li>`,
          )
          .join("")}
      </ul>
    </section>`;
}

function countMvpGoals(
  fixtures: SeasonSimResult["fixtures"],
  mvpName: string | undefined,
): number {
  if (!mvpName) return 0;
  const needle = mvpName.toLowerCase();
  let goals = 0;
  for (const f of fixtures) {
    for (const e of f.events) {
      if (e.type !== "goal") continue;
      const byName = e.playerName?.toLowerCase() === needle;
      const inText = e.text.toLowerCase().includes(needle);
      if (byName || inText) goals += 1;
    }
  }
  return goals;
}

function renderMvpEliteHtml(mvp: RatedPlayerCard, goals: number): string {
  return `
    <div class="panel db-mvp-elite db-glass">
      <p class="db-label-caps">MVP Performance</p>
      <p class="db-mvp-elite__ovr">${mvp.ovr}</p>
      <p class="db-mvp-elite__name">${mvp.name}</p>
      <div class="db-mvp-elite__meta">
        <span><b>${String(goals).padStart(2, "0")}</b> Goals</span>
        <span style="opacity:0.35">|</span>
        <span><b>${mvp.position}</b> POS</span>
      </div>
      <button class="btn btn--ghost btn--block" id="mvp-compare" type="button" style="margin-top:1rem">Compare contexts →</button>
    </div>`;
}

function seasonMonoRecord(result: SeasonSimResult): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  if (result.isPerfect) {
    return `
      <section class="db-season-mono-hero">
        <span class="db-label-caps">Season Analytics</span>
        <div class="db-season-mono-record">
          <span class="db-w">${pad(38)}W</span>
          <span class="db-sep">•</span>
          <span class="db-d">${pad(0)}D</span>
          <span class="db-sep">•</span>
          <span class="db-l">${pad(0)}L</span>
        </div>
        <p class="db-season-tagline">Perfect season. Legendary.</p>
      </section>`;
  }
  return `
    <section class="db-season-mono-hero">
      <span class="db-label-caps">Season Analytics</span>
      <div class="db-season-mono-record">
        <span class="db-w">${pad(result.won)}W</span>
        <span class="db-sep">•</span>
        <span class="db-d">${pad(result.drawn)}D</span>
        <span class="db-sep">•</span>
        <span class="db-l">${pad(result.lost)}L</span>
      </div>
      <p class="db-season-tagline">
        ${result.isUnbeaten ? `Unbeaten season — ${result.points} points` : `${result.points} pts · GD ${result.goalDifference >= 0 ? "+" : ""}${result.goalDifference}`}
      </p>
    </section>`;
}

function resultBadge(result: "W" | "D" | "L"): string {
  const cls =
    result === "W" ? "db-fixture--win" : result === "L" ? "db-fixture--loss" : "db-fixture--draw";
  return `<span class="db-fixture-badge ${cls}">${result}</span>`;
}

function renderSeasonPitchPanel(
  formationId: string,
  players: { name: string }[],
): string {
  const form = getFormation(formationId);
  const dots = form.slots
    .map((coord, i) => {
      const p = players[i];
      const last = p ? p.name.split(" ").pop() : "—";
      return `<span class="db-pitch-dot db-pitch-dot--season" style="left:${coord.y}%;top:${100 - coord.x}%">
        <span class="db-pitch-dot__pos">${coord.positionTag}</span>
        <span class="db-pitch-dot__name">${last ?? "—"}</span>
      </span>`;
    })
    .join("");
  return `
    <section class="panel db-season-pitch-panel">
      <p class="db-hero__label">Your XI · ${formationId}</p>
      ${pitchSurfaceHtml(dots, { ariaLabel: `Season squad ${formationId}` })}
    </section>`;
}

function draftEraProfileId(mode: { decade?: string; year?: number; era?: string }): string {
  if (mode.decade) {
    const map: Record<string, string> = {
      "1950s": "1950s-60s",
      "1960s": "1950s-60s",
      "1970s": "1970s-80s",
      "1980s": "1970s-80s",
      "1990s": "1990s",
      "2000s": "2000s",
      "2010s": "2010s",
      "2020s": "2020s",
    };
    return map[mode.decade] ?? "2020s";
  }
  if (mode.year != null) {
    const y = mode.year;
    if (y < 1970) return "1950s-60s";
    if (y < 1990) return "1970s-80s";
    if (y < 2000) return "1990s";
    if (y < 2010) return "2000s";
    if (y < 2020) return "2010s";
    return "2020s";
  }
  return "2020s";
}

type EraChoice = "match_draft" | "modern" | string;

export function renderDraftballerSeason(root: HTMLElement, navigate: Navigate) {
  const saved = loadSquadForSeason();
  if (!saved || !saved.players.length) {
    root.innerHTML = `
      <div class="shell db-root">
        <p class="db-hero__label">No squad saved</p>
        <p style="color:var(--db-muted)">Complete a draft first, then simulate your season.</p>
        <button class="btn" id="hub">DRAFTBALLER Hub</button>
      </div>`;
    root.querySelector("#hub")?.addEventListener("click", () => navigate("draftballer"));
    return;
  }

  const rivalPool = buildDraftPool(saved.mode);
  const draftSeed = saved.seed ?? `season_${saved.mode.id}_${saved.playerIds.join("-")}`;
  const config = loadSimConfig();
  const builder = loadSquadBuilderState();

  let eraChoice: EraChoice = "match_draft";
  if (saved.eraContext?.profileId === "2020s" && saved.eraContext.mode === "neutral_modern") {
    eraChoice = "modern";
  } else if (saved.eraContext?.profileId && saved.eraContext.mode === "custom") {
    eraChoice = saved.eraContext.profileId;
  } else if (config.eraContext.profileId && config.eraContext.mode === "custom") {
    eraChoice = config.eraContext.profileId;
  }

  let realisticFit = (saved.simulationMode ?? config.simulationMode) !== "prime_powers";

  const challengerCatalog = listSimChallengers().filter((c) => c.ready);
  const leagues = [...new Map(challengerCatalog.map((c) => [c.leagueId, c.leagueName])).entries()].sort(
    (a, b) => a[1].localeCompare(b[1]),
  );
  const richest = [...challengerCatalog].sort((a, b) => b.clubCount - a.clubCount)[0];
  let challengerLeagueId = config.challenger?.leagueId ?? richest?.leagueId ?? "";
  let challengerSeasonLabel = config.challenger?.seasonLabel ?? richest?.seasonLabel ?? "";

  function seasonsForLeague(leagueId: string) {
    return challengerCatalog
      .filter((c) => c.leagueId === leagueId)
      .sort((a, b) => b.seasonLabel.localeCompare(a.seasonLabel));
  }

  function eraProfileFromSeasonLabel(seasonLabel: string): string {
    const y = parseSeasonStartYear(seasonLabel);
    if (y == null) return draftEraProfileId(saved.mode);
    return draftEraProfileId({ year: y });
  }

  function resolveEraContext(): SimMatchConfig["eraContext"] {
    if (eraChoice === "match_draft") {
      // When a historical challenger is set, match that season's era by default.
      if (challengerSeasonLabel) {
        return {
          mode: "custom",
          profileId: eraProfileFromSeasonLabel(challengerSeasonLabel),
        };
      }
      return {
        mode: "match_higher_draft",
        profileId: draftEraProfileId(saved.mode),
      };
    }
    if (eraChoice === "modern") {
      return { mode: "neutral_modern", profileId: "2020s" };
    }
    return { mode: "custom", profileId: eraChoice };
  }

  function buildSimConfig(): SimMatchConfig {
    return {
      ...config,
      simulationMode: realisticFit ? "realistic" : "prime_powers",
      eraContext: resolveEraContext(),
      formationHomeId: saved.formationId ?? builder.formationId ?? config.formationHomeId,
      tacticalIdentityHome:
        saved.tacticalIdentity ?? builder.tacticalIdentity ?? config.tacticalIdentityHome,
      challenger:
        challengerLeagueId && challengerSeasonLabel
          ? { leagueId: challengerLeagueId, seasonLabel: challengerSeasonLabel }
          : undefined,
    };
  }

  function persistConditions(): void {
    const simConfig = buildSimConfig();
    patchSquadSimConditions({
      eraContext: simConfig.eraContext,
      simulationMode: simConfig.simulationMode,
      formationId: simConfig.formationHomeId,
      tacticalIdentity: simConfig.tacticalIdentityHome,
    });
    saveSimConfig(simConfig);
  }

  const userSquadBase = {
    name: saved.mode.title ?? "Your XI",
    playerIds: saved.playerIds,
    players: saved.players,
    squadOvr: saved.squadOvr,
    draftMode: saved.mode,
  };

  function buildChallengerOpponents(): SimSquadInput[] {
    if (!challengerLeagueId || !challengerSeasonLabel) return [];
    return generateHistoricalOpponents({
      leagueId: challengerLeagueId,
      seasonLabel: challengerSeasonLabel,
      matchCount: 38,
      seed: draftSeed,
      userSquad: userSquadBase,
      ratePlayer: (id) => ratePlayerByIdForSeason(id, challengerSeasonLabel, saved.mode),
    });
  }

  function resolvePreviewOpponents(): SimSquadInput[] {
    const historical = buildChallengerOpponents();
    if (historical.length) return historical;
    if (challengerLeagueId && challengerSeasonLabel) {
      // Challenger selected but archive thin — never fall back to Surname XI.
      return generateOpponents(
        { ...userSquadBase, formationId: buildSimConfig().formationHomeId },
        38,
        draftSeed,
        rivalPool,
        { anonymousClubsOnly: true },
      );
    }
    return generateOpponents(
      { ...userSquadBase, formationId: buildSimConfig().formationHomeId },
      38,
      draftSeed,
      rivalPool,
    );
  }

  let previewOpponents = resolvePreviewOpponents();
  let opponentAvgOvr =
    previewOpponents.length > 0
      ? Math.round(previewOpponents.reduce((s, o) => s + o.squadOvr, 0) / previewOpponents.length)
      : 72;
  let preview = predictSeasonOutlook(
    { ...userSquadBase, squadOvr: saved.squadOvr },
    opponentAvgOvr,
  );

  function refreshPreview() {
    previewOpponents = resolvePreviewOpponents();
    opponentAvgOvr =
      previewOpponents.length > 0
        ? Math.round(previewOpponents.reduce((s, o) => s + o.squadOvr, 0) / previewOpponents.length)
        : 72;
    preview = predictSeasonOutlook(
      { ...userSquadBase, squadOvr: saved.squadOvr },
      opponentAvgOvr,
    );
  }

  let result: SeasonSimResult | null = null;
  let simRunning = false;

  function drawPreSim() {
    const simConfig = buildSimConfig();
    const era = resolveEraProfile(simConfig.eraContext, saved.mode.decade);
    const fitLine =
      simConfig.simulationMode === "realistic"
        ? fitPreviewHeadline(saved.players, era)
        : "Prime Powers: pure base OVR — era fit disabled";

    const decadeOptions = listEraProfiles()
      .filter((p) => !p.id.includes("serie") && !p.id.includes("world-cup"))
      .map(
        (p) =>
          `<option value="${p.id}" ${eraChoice === p.id ? "selected" : ""}>${p.label}</option>`,
      )
      .join("");

    const leagueOptions = leagues
      .map(
        ([id, name]) =>
          `<option value="${id}" ${id === challengerLeagueId ? "selected" : ""}>${name}</option>`,
      )
      .join("");
    const seasonOpts = seasonsForLeague(challengerLeagueId);
    if (seasonOpts.length && !seasonOpts.some((s) => s.seasonLabel === challengerSeasonLabel)) {
      challengerSeasonLabel = seasonOpts[0]!.seasonLabel;
    }
    const seasonOptions = seasonOpts
      .map(
        (s) =>
          `<option value="${s.seasonLabel}" ${s.seasonLabel === challengerSeasonLabel ? "selected" : ""}>${s.seasonLabel} · ${s.clubCount} clubs</option>`,
      )
      .join("");
    const coverage = seasonOpts.find((s) => s.seasonLabel === challengerSeasonLabel);
    const historicalPreview = previewOpponents[0]?.name?.match(/XI \(\d+ OVR\)/)
      ? false
      : previewOpponents.length > 0 && Boolean(challengerLeagueId);

    root.innerHTML = `
      <div class="shell db-root db-season-page">
        <button class="btn btn--ghost" id="back">← Hub</button>
        <header class="db-hero">
          <p class="db-hero__label">${saved.mode.title} · Season Preview</p>
          <h1 class="db-hero__title">Before the whistle blows</h1>
          <p class="db-hero__sub">Pick any archived league &amp; season, set era conditions, then run 38 real fixtures.</p>
        </header>

        <div class="panel db-report db-match-conditions">
          <p class="db-hero__label">Historical challenger</p>
          <h2 class="db-report__title">League &amp; season</h2>
          ${
            leagues.length
              ? `
          <label class="db-stat-label">League</label>
          <select id="challengerLeague" class="btn btn--ghost btn--block">${leagueOptions}</select>
          <label class="db-stat-label" style="margin-top:10px">Season</label>
          <select id="challengerSeason" class="btn btn--ghost btn--block">${seasonOptions}</select>
          <p style="font-size:0.8rem;color:var(--db-muted);margin:8px 0 0">
            ${
              coverage
                ? `${coverage.clubCount} archive clubs ready${historicalPreview ? " · real club fixtures" : " · building squads…"}`
                : "Select a league with archive coverage"
            }
          </p>`
              : `<p style="color:var(--db-muted);font-size:0.9rem">Archive catalog not loaded — synthetic rivals will be used.</p>`
          }
        </div>

        ${renderSeasonPredictionHtml(preview)}

        <div class="panel db-report db-match-conditions">
          <p class="db-hero__label">Match Conditions</p>
          <h2 class="db-report__title">Simulation era</h2>
          <label class="db-stat-label">Era context</label>
          <select id="eraChoice" class="btn btn--ghost btn--block">
            <option value="match_draft" ${eraChoice === "match_draft" ? "selected" : ""}>Match challenger / draft era</option>
            <option value="modern" ${eraChoice === "modern" ? "selected" : ""}>Modern (2020s)</option>
            <optgroup label="Decade picker">
              ${decadeOptions}
            </optgroup>
          </select>
          <label class="db-stat-label" style="margin-top:12px;display:flex;gap:8px;align-items:center">
            <input type="checkbox" id="realisticFit" ${realisticFit ? "checked" : ""} />
            Realistic Era Fit (recommended)
          </label>
          <p style="font-size:0.8rem;color:var(--db-muted);margin:4px 0 0">Off = Prime Powers (pure base OVR, no era penalties)</p>
          <p class="db-fit-preview" style="margin-top:12px;color:var(--db-gold);font-size:0.95rem">${fitLine}</p>
          <ul class="db-report__bullets" style="margin-top:12px">
            <li><strong>Formation:</strong> ${simConfig.formationHomeId} · ${simConfig.tacticalIdentityHome.replace("_", " ")}</li>
            <li><strong>Squad OVR:</strong> ${saved.squadOvr} · ${saved.players.length} players drafted</li>
            <li><strong>Resolved era:</strong> ${era.label}</li>
            <li><strong>Opponents:</strong> ${
              historicalPreview
                ? `${challengerLeagueId} ${challengerSeasonLabel}`
                : "Synthetic league pyramid"
            }</li>
          </ul>
        </div>

        <div class="db-season-actions">
          <button class="btn db-season-sim-btn" id="runSim" ${simRunning ? "disabled" : ""}>
            ${simRunning ? "Simulating…" : "Run 38-game season simulation"}
          </button>
          <button class="btn btn--ghost" id="setup">Full sim setup</button>
          <button class="btn btn--ghost" id="squad">Squad builder</button>
        </div>
      </div>`;

    root.querySelector("#back")?.addEventListener("click", () => navigate("draftballer"));
    root.querySelector("#setup")?.addEventListener("click", () => {
      persistConditions();
      navigate("draftballer", "sim-setup");
    });
    root.querySelector("#squad")?.addEventListener("click", () => navigate("draftballer", "squad-builder"));
    root.querySelector("#challengerLeague")?.addEventListener("change", (e) => {
      challengerLeagueId = (e.target as HTMLSelectElement).value;
      const next = seasonsForLeague(challengerLeagueId)[0];
      challengerSeasonLabel = next?.seasonLabel ?? "";
      refreshPreview();
      persistConditions();
      drawPreSim();
    });
    root.querySelector("#challengerSeason")?.addEventListener("change", (e) => {
      challengerSeasonLabel = (e.target as HTMLSelectElement).value;
      refreshPreview();
      persistConditions();
      drawPreSim();
    });
    root.querySelector("#eraChoice")?.addEventListener("change", (e) => {
      eraChoice = (e.target as HTMLSelectElement).value as EraChoice;
      persistConditions();
      drawPreSim();
    });
    root.querySelector("#realisticFit")?.addEventListener("change", (e) => {
      realisticFit = (e.target as HTMLInputElement).checked;
      persistConditions();
      drawPreSim();
    });
    root.querySelector("#runSim")?.addEventListener("click", () => {
      if (simRunning) return;
      simRunning = true;
      persistConditions();
      runLiveSeason();
    });
  }

  function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function runLiveSeason() {
    const simConfig = buildSimConfig();
    const userSquad = {
      ...userSquadBase,
      formationId: simConfig.formationHomeId,
      tacticalIdentity: simConfig.tacticalIdentityHome,
    };
    const era = resolveEraProfile(simConfig.eraContext, saved.mode.decade);

    root.innerHTML = `
      <div class="shell db-root db-season-page db-season-live">
        <header class="db-hero">
          <p class="db-hero__label">${saved.mode.title} · Season Live · ${era.label}</p>
          <h1 class="db-hero__title" id="live-md">Matchday 1 of 38</h1>
          <p class="db-hero__sub" id="live-record">0W · 0D · 0L · 0 pts</p>
        </header>
        <div class="panel db-season-stats" id="live-stats">
          <div><span class="db-stat-label">GF</span><strong id="live-gf">0</strong></div>
          <div><span class="db-stat-label">GA</span><strong id="live-ga">0</strong></div>
          <div><span class="db-stat-label">GD</span><strong id="live-gd">0</strong></div>
        </div>
        <div class="panel db-fixtures">
          <strong>Fixtures</strong>
          <div class="db-fixture-list" id="live-fixtures"></div>
        </div>
      </div>`;

    const liveFixtures = root.querySelector("#live-fixtures")!;
    const liveMd = root.querySelector("#live-md")!;
    const liveRecord = root.querySelector("#live-record")!;
    const liveGf = root.querySelector("#live-gf")!;
    const liveGa = root.querySelector("#live-ga")!;
    const liveGd = root.querySelector("#live-gd")!;

    const challengerOpponents = buildChallengerOpponents();
    result = await simulateSeason(userSquad, draftSeed, {
      rivalPool,
      config: simConfig,
      challengerOpponents: challengerOpponents.length ? challengerOpponents : undefined,
      ratePlayer: (id) => ratePlayerByIdForSeason(id, challengerSeasonLabel || "2024/25", saved.mode) ?? undefined,
      onMatchComplete: async ({ fixture, matchday, totals }) => {
        liveMd.textContent = `Matchday ${matchday} of 38`;
        liveRecord.textContent = `${totals.won}W · ${totals.drawn}D · ${totals.lost}L · ${totals.points} pts`;
        liveGf.textContent = String(totals.goalsFor);
        liveGa.textContent = String(totals.goalsAgainst);
        const gd = totals.goalsFor - totals.goalsAgainst;
        liveGd.textContent = `${gd >= 0 ? "+" : ""}${gd}`;

        const row = document.createElement("div");
        row.className = "db-fixture-row db-fixture-row--live";
        row.innerHTML = `
          <span class="db-fixture-md">MD${fixture.matchday}</span>
          ${resultBadge(fixture.result)}
          <span class="db-fixture-score">${fixture.home ? "" : "(A) "}${fixture.goalsFor}–${fixture.goalsAgainst}</span>
          <span class="db-fixture-opp">${fixture.opponent}</span>`;
        liveFixtures.prepend(row);
        await delay(matchday <= 3 ? 420 : matchday <= 10 ? 280 : 180);
      },
    });

    recordSeasonTrophies(result, saved.mode.title ?? "Season");
    recordSeasonProgress(result);
    simRunning = false;
    await delay(400);
    drawPostSim();
  }

  function drawPostSim() {
    if (!result) return;

    const simConfig = buildSimConfig();
    const era = getEraProfile(result.eraProfileId === "prime_powers" ? "2020s" : result.eraProfileId ?? "2020s");
    const [sampleOpp] = generateOpponents(
      { ...userSquadBase, formationId: simConfig.formationHomeId },
      1,
      `${result.seed}:sample`,
      rivalPool,
    );
    const sampleMatch = simulateMatchV2(
      { ...userSquadBase, formationId: simConfig.formationHomeId, tacticalIdentity: simConfig.tacticalIdentityHome },
      sampleOpp!,
      `${result.seed}:sample`,
      1,
      { config: simConfig },
    );
    const mvp = saved.players.find((p) => p.playerId === result!.mvpPlayerId);
    const mvpGoals = countMvpGoals(result.fixtures, result.mvpPlayerName);
    const fitReport = result.seasonFitReport?.length ? result.seasonFitReport : sampleMatch.fitReport;
    const finish = seasonFinishLabel(result.points);

    root.innerHTML = `
      <div class="shell db-root db-season-page db-season-page--post" data-season-ui="${SEASON_UI_BUILD}">
        <button class="btn btn--ghost" id="back">← Hub</button>
        <header class="db-hero db-post-hero">
          <p class="db-label-caps">${saved.mode.title} · Season Complete · ${era.label}</p>
        </header>

        ${seasonMonoRecord(result)}

        ${renderSeasonAnalysisHtml(result)}

        ${renderSeasonPitchPanel(simConfig.formationHomeId ?? "4-3-3", saved.players)}

        <div class="panel db-season-stats db-season-stats--post">
          <div class="db-season-finish db-season-finish--${finish.tier}">
            <span class="db-hero__label">Table finish</span>
            <strong class="db-season-finish__label">${finish.label}</strong>
            <span class="db-season-finish__pts">${result.points} pts</span>
          </div>
          <div class="db-season-stats__grid">
            <div><span class="db-stat-label">Played</span><strong>${result.played}</strong></div>
            <div><span class="db-stat-label">Points</span><strong class="db-stat-gold">${result.points}</strong></div>
            <div><span class="db-stat-label">GF</span><strong>${result.goalsFor}</strong></div>
            <div><span class="db-stat-label">GA</span><strong>${result.goalsAgainst}</strong></div>
          </div>
        </div>

        ${renderFitReportHtml(fitReport, `Season Fit Report · ${era.label}`)}

        ${
          mvp
            ? renderMvpEliteHtml(mvp, mvpGoals)
            : ""
        }

        <section class="panel db-fixtures db-post-fixtures">
          <p class="db-hero__label">All 38 fixtures</p>
          <div class="db-fixture-list db-fixture-list--post">
            ${result.fixtures
              .map(
                (f) => `
              <div class="db-fixture-row db-fixture-row--post">
                <span class="db-fixture-md">MD${f.matchday}</span>
                ${resultBadge(f.result)}
                <span class="db-fixture-score db-fixture-score--tab">${f.home ? "" : "(A) "}${f.goalsFor}–${f.goalsAgainst}</span>
                <span class="db-fixture-opp">${f.opponent}</span>
              </div>`,
              )
              .join("")}
          </div>
        </section>

        ${renderKeyMomentsHtml(result.fixtures)}

        <details class="panel db-report db-post-preview">
          <summary class="db-report__title db-post-preview__summary">Pre-season preview (for reference)</summary>
          ${renderSeasonPredictionHtml(result.prediction ?? preview)}
        </details>

        <div class="db-season-actions">
          <button class="btn btn--ghost" id="share" type="button">Share</button>
          <button class="btn db-btn-pitch" id="runBack" type="button">Run It Back</button>
          <button class="btn btn--ghost" id="newDraft" type="button">New Draft</button>
          <details class="db-overflow-menu">
            <summary>More</summary>
            <div class="db-overflow-menu__body">
              <button class="btn btn--ghost btn--block" id="eraLab" type="button">Era Lab</button>
              <button class="btn btn--ghost btn--block" id="h2h" type="button">Instant H2H</button>
              <button class="btn btn--ghost btn--block" id="mini" type="button">Mini league</button>
            </div>
          </details>
        </div>
      </div>`;

    bindPlayerCardBreakdownsWithPool(root, rivalPool);
    root.querySelector("#back")?.addEventListener("click", () => navigate("draftballer"));
    root.querySelector("#mvp-compare")?.addEventListener("click", () => {
      if (mvp) navigate("draftballer", `compare/${mvp.playerId}`);
    });
    root.querySelector("#eraLab")?.addEventListener("click", () => {
      persistConditions();
      navigate("draftballer", "era-lab");
    });
    root.querySelector("#runBack")?.addEventListener("click", () => {
      // Same squad + seed — re-open Match Conditions (determinism preserved).
      result = null;
      simRunning = false;
      drawPreSim();
    });
    root.querySelector("#newDraft")?.addEventListener("click", () => navigate("draftballer", "wheel"));
    root.querySelector("#h2h")?.addEventListener("click", () => navigate("draftballer", "h2h"));
    root.querySelector("#mini")?.addEventListener("click", () => navigate("draftballer", "mini-league"));
    root.querySelector("#share")?.addEventListener("click", async () => {
      const url = buildShareCardDataUrl(
        result!,
        `${saved.mode.title ?? "Season"} · ${era.label}`,
        saved.squadOvr,
        result!.mvpPlayerName,
      );
      if (navigator.share) {
        const blob = await (await fetch(url)).blob();
        const file = new File([blob], "draftballer-season.png", { type: "image/png" });
        await navigator.share({ files: [file], title: "DRAFTBALLER Season" });
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = "draftballer-season.png";
        a.click();
      }
    });
  }

  drawPreSim();
}
