import type { EraLabResult, SeasonSimResult } from "@sportverse/draftballer-types";

/** Generate a shareable PNG data URL for season results (1080×1350 target scaled to canvas). */
export function buildShareCardDataUrl(
  result: SeasonSimResult,
  modeTitle: string,
  squadOvr: number,
  mvpName?: string,
): string {
  const w = 540;
  const h = 675;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.fillStyle = "#0b0d10";
  ctx.fillRect(0, 0, w, h);

  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, "#d4af37");
  grad.addColorStop(1, "#3fd188");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, 4);

  ctx.fillStyle = "#d4af37";
  ctx.font = "600 12px system-ui";
  ctx.fillText("DRAFTBALLER · SPORTVERSE", 24, 36);

  ctx.fillStyle = "#f5f5f5";
  ctx.font = "700 28px Georgia";
  ctx.fillText(modeTitle, 24, 72);

  ctx.fillStyle = result.isPerfect ? "#3fd188" : "#d4af37";
  ctx.font = "800 42px system-ui";
  const headline = result.isPerfect ? "38 — 0 — 0" : `${result.won}W · ${result.drawn}D · ${result.lost}L`;
  ctx.fillText(headline, 24, 130);

  ctx.fillStyle = "#9aa4b2";
  ctx.font="400 16px system-ui";
  ctx.fillText(`${result.points} pts · GD ${result.goalDifference >= 0 ? "+" : ""}${result.goalDifference}`, 24, 160);
  ctx.fillText(`Squad OVR ${squadOvr} · ${result.goalsFor} GF / ${result.goalsAgainst} GA`, 24, 184);
  if (mvpName) ctx.fillText(`MVP: ${mvpName}`, 24, 208);

  ctx.strokeStyle = "#1c2128";
  ctx.beginPath();
  ctx.moveTo(24, 230);
  ctx.lineTo(w - 24, 230);
  ctx.stroke();

  ctx.fillStyle = "#9aa4b2";
  ctx.font = "500 11px system-ui";
  let y = 252;
  for (const f of result.fixtures.slice(-8)) {
    ctx.fillText(`MD${f.matchday}  ${f.goalsFor}-${f.goalsAgainst}  ${f.result}  ${f.opponent.slice(0, 28)}`, 24, y);
    y += 22;
  }

  ctx.fillStyle = "#6b7280";
  ctx.font = "400 11px system-ui";
  ctx.fillText("Draft · Simulate · Share", 24, h - 24);

  return canvas.toDataURL("image/png");
}

/** Share-card for Era Lab batch results. */
export function buildEraLabShareDataUrl(result: EraLabResult): string {
  const w = 540;
  const h = 675;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.fillStyle = "#0b0d10";
  ctx.fillRect(0, 0, w, h);
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, "#d4af37");
  grad.addColorStop(1, "#3fd188");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, 4);

  ctx.fillStyle = "#d4af37";
  ctx.font = "600 12px system-ui";
  ctx.fillText("DRAFTBALLER · ERA LAB", 24, 36);

  ctx.fillStyle = "#f5f5f5";
  ctx.font = "700 26px Georgia";
  ctx.fillText(result.squadName.slice(0, 28), 24, 72);

  ctx.fillStyle = "#9aa4b2";
  ctx.font = "400 13px system-ui";
  ctx.fillText("W-D-L across every reference era", 24, 98);

  let y = 130;
  ctx.font = "500 13px system-ui";
  for (const row of result.rows.slice(0, 10)) {
    ctx.fillStyle = "#f5f5f5";
    ctx.fillText(row.label.slice(0, 22), 24, y);
    ctx.fillStyle = "#d4af37";
    ctx.fillText(`${row.wins}-${row.draws}-${row.losses}`, 320, y);
    ctx.fillStyle = "#9aa4b2";
    ctx.fillText(`fit ${row.avgFitDelta >= 0 ? "+" : ""}${row.avgFitDelta}`, 420, y);
    y += 28;
  }

  ctx.fillStyle = "#6b7280";
  ctx.font = "400 11px system-ui";
  ctx.fillText("Draft era ≠ simulation era", 24, h - 24);

  return canvas.toDataURL("image/png");
}
