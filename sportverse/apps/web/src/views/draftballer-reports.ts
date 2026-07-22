import type {
  ExpectationGradeCode,
  FitReportLine,
  SeasonExpectationGrade,
  SeasonPrediction,
  SeasonSimResult,
} from "@sportverse/draftballer-types";

const TIER_LABELS: Record<SeasonPrediction["outlookTier"], string> = {
  title_challenger: "Title Challenger",
  european_push: "European Push",
  mid_table: "Mid-Table Steady",
  survival_scrap: "Survival Scrap",
  relegation_battle: "Relegation Battle",
};

const GRADE_CLASS: Record<ExpectationGradeCode, string> = {
  exceeded: "db-grade--exceeded",
  overperformed: "db-grade--over",
  met: "db-grade--met",
  slightly_above: "db-grade--slight-over",
  slightly_below: "db-grade--slight-under",
  underperformed: "db-grade--under",
  underwhelmed: "db-grade--underwhelmed",
};

/** Pre-sim pundit-style forecast — shown before the engine runs. */
export function renderSeasonPredictionHtml(prediction: SeasonPrediction): string {
  return `
    <section class="panel db-report db-report--prediction" aria-labelledby="season-prediction-heading">
      <header class="db-report__header">
        <p class="db-hero__label">Pre-Season Forecast</p>
        <h2 id="season-prediction-heading" class="db-report__title">What the table-toppers look like on paper</h2>
        <p class="db-report__lede">${prediction.headline}</p>
      </header>

      <div class="db-report__tier db-report__tier--${prediction.outlookTier}">
        <span class="db-report__tier-label">${TIER_LABELS[prediction.outlookTier]}</span>
        <span class="db-report__tier-sub">Superficial read · squad OVR only</span>
      </div>

      <p class="db-report__narrative">${prediction.narrative}</p>

      <div class="db-report__grid">
        <div class="db-report__stat">
          <span class="db-stat-label">Projected record</span>
          <strong>${prediction.expectedWins}W · ${prediction.expectedDraws}D · ${prediction.expectedLosses}L</strong>
        </div>
        <div class="db-report__stat">
          <span class="db-stat-label">Expected points</span>
          <strong style="color:var(--db-gold)">${prediction.expectedPoints}</strong>
        </div>
        <div class="db-report__stat">
          <span class="db-stat-label">Expected GD</span>
          <strong>${prediction.expectedGoalDifference >= 0 ? "+" : ""}${prediction.expectedGoalDifference}</strong>
        </div>
        <div class="db-report__stat">
          <span class="db-stat-label">Goals (F–A)</span>
          <strong>${prediction.expectedGoalsFor}–${prediction.expectedGoalsAgainst}</strong>
        </div>
        <div class="db-report__stat">
          <span class="db-stat-label">Your XI avg</span>
          <strong>${prediction.avgXiOvr} OVR</strong>
        </div>
        <div class="db-report__stat">
          <span class="db-stat-label">Opposition avg</span>
          <strong>${prediction.opponentAvgOvr} OVR</strong>
        </div>
      </div>

      ${
        prediction.starPlayerName
          ? `<p class="db-report__footnote">Star pick: <strong>${prediction.starPlayerName}</strong> (${prediction.starPlayerOvr} OVR) · Squad rating ${prediction.squadOvr}</p>`
          : ""
      }

      <p class="db-report__disclaimer">${prediction.disclaimer}</p>
    </section>`;
}

/** Post-sim verdict comparing actual results to the pre-season preview. */
export function renderExpectationGradeHtml(grade: SeasonExpectationGrade): string {
  const ptsSign = grade.pointsDelta >= 0 ? "+" : "";
  const gdDeltaSign = grade.goalDifferenceDelta >= 0 ? "+" : "";
  const actualGd =
    grade.prediction.expectedGoalDifference + grade.goalDifferenceDelta;
  const actualGdSign = actualGd >= 0 ? "+" : "";
  const expectedPct = Math.min(100, Math.round((grade.prediction.expectedPoints / 114) * 100));
  const actualPct = Math.min(100, Math.round((grade.actualPoints / 114) * 100));
  const underperformed = grade.pointsDelta < 0;
  const verdictAccent = underperformed ? "#ff4c4c" : "var(--db-pitch)";
  const actualBarClass = underperformed ? "db-verdict-bar-fill--actual--bad" : "db-verdict-bar-fill--actual--good";

  return `
    <section class="panel db-report db-report--verdict db-glass ${GRADE_CLASS[grade.grade]}" aria-labelledby="season-verdict-heading">
      <header class="db-report__header">
        <p class="db-label-caps">Performance Status</p>
        <h2 id="season-verdict-heading" class="db-report__title">
          Verdict: <span style="color:${verdictAccent}">${grade.label}</span>
        </h2>
        <p class="db-report__lede">${grade.summary}</p>
      </header>

      <div class="db-verdict-bars">
        <div class="db-verdict-bar-row">
          <div class="db-verdict-bar-head">
            <span>Expected Pts (xP)</span>
            <strong>${grade.prediction.expectedPoints}</strong>
          </div>
          <div class="db-verdict-bar-track">
            <div class="db-verdict-bar-fill db-verdict-bar-fill--expected" style="width:${expectedPct}%"></div>
          </div>
        </div>
        <div class="db-verdict-bar-row">
          <div class="db-verdict-bar-head">
            <span>Actual Pts</span>
            <strong style="color:${verdictAccent}">${grade.actualPoints}</strong>
          </div>
          <div class="db-verdict-bar-track">
            <div class="db-verdict-bar-fill ${actualBarClass}" style="width:${actualPct}%"></div>
          </div>
        </div>
      </div>

      <div class="db-report__compare db-report__compare--cards" style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--db-border)">
        <div class="db-report__compare-col db-report__compare-col--preview">
          <span class="db-stat-label">Pre-season</span>
          <strong class="db-report__compare-pts">${grade.prediction.expectedPoints} pts</strong>
          <span class="db-report__compare-sub">${grade.prediction.expectedWins}W · ${grade.prediction.expectedDraws}D · ${grade.prediction.expectedLosses}L</span>
        </div>
        <div class="db-report__compare-arrow" aria-hidden="true">→</div>
        <div class="db-report__compare-col db-report__compare-col--actual">
          <span class="db-stat-label">Actual</span>
          <strong class="db-report__compare-pts">${grade.actualPoints} pts</strong>
          <span class="db-report__compare-sub">${grade.actualRecord}</span>
          <span class="db-report__compare-sub">GD ${actualGdSign}${actualGd} · Δ ${ptsSign}${grade.pointsDelta} pts · Δ GD ${gdDeltaSign}${grade.goalDifferenceDelta}</span>
        </div>
      </div>
    </section>`;
}

/** Enhanced fit report — sorted by |delta|, top 5 shown, expandable to full XI. */
export function renderFitReportHtml(fitReport: FitReportLine[], headline?: string): string {
  if (!fitReport.length) return "";
  const sorted = [...fitReport].sort(
    (a, b) => Math.abs(b.effectiveDelta) - Math.abs(a.effectiveDelta),
  );
  const strugglers = sorted.filter((f) => f.effectiveDelta <= -4);
  const standouts = sorted.filter((f) => f.effectiveDelta >= 4);

  let summary = "";
  if (strugglers.length) {
    summary = `${strugglers[0]!.playerName} struggled most in this context (${strugglers[0]!.effectiveDelta} effective delta).`;
  } else if (standouts.length) {
    summary = `${standouts[0]!.playerName} thrived here (+${standouts[0]!.effectiveDelta} vs base profile).`;
  }

  const rowHtml = (f: FitReportLine) => {
    const cls =
      f.effectiveDelta >= 4 ? "db-fit-row--good" : f.effectiveDelta <= -4 ? "db-fit-row--bad" : "";
    const barPct = Math.min(100, Math.round(Math.abs(f.effectiveDelta) * 10));
    const deltaSign = f.effectiveDelta >= 0 ? "+" : "";
    return `<li class="db-fit-row db-fit-row--report ${cls}">
      <span class="db-fit-row__name">${f.playerName}</span>
      <span class="db-fit-row__base">OVR ${f.baseOvr}</span>
      <span class="db-fit-row__delta-wrap">
        <span class="db-fit-row__delta">${deltaSign}${f.effectiveDelta}</span>
        <span class="db-fit-row__bar" style="width:${barPct}%"></span>
      </span>
      <span class="db-fit-row__summary">${f.summary}</span>
    </li>`;
  };

  const top = sorted.slice(0, 5);
  const rest = sorted.slice(5);

  return `
    <section class="panel db-report db-report--fit" aria-labelledby="fit-report-heading">
      <header class="db-report__header">
        ${headline ? `<p class="db-hero__label">${headline}</p>` : ""}
        <h2 id="fit-report-heading" class="db-report__title">Era &amp; tactical fit report</h2>
        ${summary ? `<p class="db-report__lede">${summary}</p>` : ""}
      </header>
      <ul class="db-fit-list db-report__fit-list">
        ${top.map(rowHtml).join("")}
      </ul>
      ${
        rest.length
          ? `<details class="db-fit-expand">
              <summary>Show full XI (${sorted.length})</summary>
              <ul class="db-fit-list db-report__fit-list">${rest.map(rowHtml).join("")}</ul>
            </details>`
          : ""
      }
    </section>`;
}

/** Full post-season analytical report block. */
export function renderSeasonAnalysisHtml(result: SeasonSimResult): string {
  const gradeBlock = result.expectationGrade ? renderExpectationGradeHtml(result.expectationGrade) : "";
  return `
    ${gradeBlock}
    <section class="panel db-report db-report--analysis">
      <header class="db-report__header">
        <p class="db-hero__label">Season Analysis</p>
        <h2 class="db-report__title">The full story</h2>
      </header>
      <ul class="db-report__bullets">
        <li><strong>Points per game:</strong> ${(result.points / result.played).toFixed(2)} — ${result.points >= 70 ? "promotion pace in most leagues" : result.points >= 50 ? "respectable mid-table form" : "a grind of a campaign"}.</li>
        <li><strong>Attack vs defence:</strong> ${result.goalsFor} scored, ${result.goalsAgainst} conceded (GD ${result.goalDifference >= 0 ? "+" : ""}${result.goalDifference}).</li>
        ${
          result.mvpPlayerName
            ? `<li><strong>Standout performer:</strong> ${result.mvpPlayerName} led the line when it mattered.</li>`
            : ""
        }
        ${
          result.isPerfect
            ? `<li><strong>Historic run:</strong> A perfect 38-from-38 — the simulation engine had no answer for this XI.</li>`
            : result.isUnbeaten
              ? `<li><strong>Unbeaten:</strong> An entire league season without defeat — elite resilience across the schedule.</li>`
              : ""
        }
      </ul>
    </section>`;
}
