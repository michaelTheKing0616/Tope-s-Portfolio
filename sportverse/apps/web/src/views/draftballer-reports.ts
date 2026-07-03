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
  const gdSign = grade.goalDifferenceDelta >= 0 ? "+" : "";
  return `
    <section class="panel db-report db-report--verdict ${GRADE_CLASS[grade.grade]}" aria-labelledby="season-verdict-heading">
      <header class="db-report__header">
        <p class="db-hero__label">Season Verdict</p>
        <h2 id="season-verdict-heading" class="db-report__title">${grade.label}</h2>
        <p class="db-report__lede">${grade.summary}</p>
      </header>

      <div class="db-report__compare">
        <div class="db-report__compare-col">
          <span class="db-stat-label">Pre-season preview</span>
          <strong>${grade.prediction.expectedPoints} pts</strong>
          <span class="db-report__compare-sub">${grade.prediction.expectedWins}W-${grade.prediction.expectedDraws}D-${grade.prediction.expectedLosses}L · GD ${grade.prediction.expectedGoalDifference >= 0 ? "+" : ""}${grade.prediction.expectedGoalDifference}</span>
        </div>
        <div class="db-report__compare-arrow" aria-hidden="true">→</div>
        <div class="db-report__compare-col db-report__compare-col--actual">
          <span class="db-stat-label">Actual season</span>
          <strong>${grade.actualPoints} pts</strong>
          <span class="db-report__compare-sub">${grade.actualRecord} · Δ ${ptsSign}${grade.pointsDelta} pts · GD ${gdSign}${grade.goalDifferenceDelta}</span>
        </div>
      </div>
    </section>`;
}

/** Enhanced fit report with conversational summaries. */
export function renderFitReportHtml(fitReport: FitReportLine[], headline?: string): string {
  if (!fitReport.length) return "";
  const sorted = [...fitReport].sort((a, b) => a.effectiveDelta - b.effectiveDelta);
  const strugglers = sorted.filter((f) => f.effectiveDelta <= -4);
  const standouts = sorted.filter((f) => f.effectiveDelta >= 4).reverse();

  let summary = "";
  if (strugglers.length) {
    summary = `${strugglers[0]!.playerName} struggled most in this context (${strugglers[0]!.effectiveDelta} effective delta).`;
  } else if (standouts.length) {
    summary = `${standouts[0]!.playerName} thrived here (+${standouts[0]!.effectiveDelta} vs base profile).`;
  }

  return `
    <section class="panel db-report db-report--fit" aria-labelledby="fit-report-heading">
      <header class="db-report__header">
        ${headline ? `<p class="db-hero__label">${headline}</p>` : ""}
        <h2 id="fit-report-heading" class="db-report__title">Era &amp; tactical fit report</h2>
        ${summary ? `<p class="db-report__lede">${summary}</p>` : ""}
      </header>
      <ul class="db-fit-list db-report__fit-list">
        ${sorted
          .slice(0, 11)
          .map((f) => {
            const cls =
              f.effectiveDelta >= 4 ? "db-fit-row--good" : f.effectiveDelta <= -4 ? "db-fit-row--bad" : "";
            return `<li class="db-fit-row ${cls}">
              <span class="db-fit-row__name">${f.playerName}</span>
              <span class="db-fit-row__delta">${f.effectiveDelta >= 0 ? "+" : ""}${f.effectiveDelta}</span>
              <span class="db-fit-row__summary">${f.summary}</span>
            </li>`;
          })
          .join("")}
      </ul>
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
