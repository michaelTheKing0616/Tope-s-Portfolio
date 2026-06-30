import type { Meeting, MinutesStyle } from "./types.js";

const STYLE_LABELS: Record<MinutesStyle, string> = {
  formal: "Formal Board Minutes",
  agile: "Agile Standup / Sprint Notes",
  executive: "Executive Brief",
  parliamentary: "Parliamentary Record",
  action: "Action-Items Focus",
};

export function formatMinutes(meeting: Meeting, style: MinutesStyle = meeting.style): string {
  const fn = FORMATTERS[style] ?? formatFormal;
  return fn(meeting);
}

export function formatMinutesHtml(meeting: Meeting, style?: MinutesStyle): string {
  const md = formatMinutes(meeting, style ?? meeting.style);
  const body = md
    .split("\n")
    .map((line) => {
      if (line.startsWith("# ")) return `<h1>${esc(line.slice(2))}</h1>`;
      if (line.startsWith("## ")) return `<h2>${esc(line.slice(3))}</h2>`;
      if (line.startsWith("### ")) return `<h3>${esc(line.slice(4))}</h3>`;
      if (line.startsWith("- ")) return `<li>${esc(line.slice(2))}</li>`;
      if (!line.trim()) return "";
      return `<p>${esc(line)}</p>`;
    })
    .join("\n");
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><title>${esc(meeting.title)} — Minutes</title>
<style>
  body{font-family:Georgia,serif;max-width:720px;margin:40px auto;padding:0 24px;line-height:1.65;color:#1a1a1a}
  h1{font-weight:400;border-bottom:1px solid #ccc;padding-bottom:12px}
  h2{font-size:1.1rem;text-transform:uppercase;letter-spacing:.12em;margin-top:2rem;color:#555}
  li{margin:.35rem 0}
  .meta{color:#666;font-size:.9rem}
</style></head><body>${body}</body></html>`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function header(meeting: Meeting, label: string): string {
  return `# ${meeting.title}\n\n**${label}**\n\n**Date:** ${meeting.date}\n**Attendees:** ${meeting.attendees.join(", ") || "—"}\n`;
}

function transcriptBlock(meeting: Meeting): string {
  const lines = meeting.transcript.map((s) => {
    const who = s.speaker ? `**${s.speaker}:** ` : "";
    const ts = s.startMs != null ? `[${formatMs(s.startMs)}] ` : "";
    return `- ${ts}${who}${s.text}`;
  });
  return `## Transcript\n\n${lines.join("\n")}\n`;
}

function summaryBlock(meeting: Meeting): string {
  if (!meeting.summary) return "";
  return `## Summary\n\n${meeting.summary}\n`;
}

function decisionsBlock(meeting: Meeting): string {
  if (!meeting.decisions.length) return "";
  return `## Decisions\n\n${meeting.decisions.map((d) => `- ${d}`).join("\n")}\n`;
}

function actionsBlock(meeting: Meeting): string {
  if (!meeting.actionItems.length) return "";
  return `## Action Items\n\n${meeting.actionItems
    .map((a) => `- **${a.owner}** — ${a.task}${a.due ? ` (due ${a.due})` : ""} [${a.status}]`)
    .join("\n")}\n`;
}

function formatFormal(m: Meeting): string {
  return `${header(m, STYLE_LABELS.formal)}

## Call to Order
Meeting convened on ${m.date}.

${summaryBlock(m)}
${decisionsBlock(m)}
${actionsBlock(m)}
## Discussion Record
${transcriptBlock(m)}
## Adjournment
Minutes prepared by Akowe.
`;
}

function formatAgile(m: Meeting): string {
  return `${header(m, STYLE_LABELS.agile)}

## Sprint Context
${m.summary ?? "_No summary generated._"}

## Blockers & Decisions
${m.decisions.map((d) => `- ${d}`).join("\n") || "- None recorded"}

## Action Items (owners)
${actionsBlock(m) || "- None"}

## Notes
${m.transcript.slice(-8).map((s) => `- ${s.speaker ? s.speaker + ": " : ""}${s.text}`).join("\n")}
`;
}

function formatExecutive(m: Meeting): string {
  return `${header(m, STYLE_LABELS.executive)}

## Executive Summary
${m.summary ?? "_Pending summarization._"}

## Key Decisions
${m.decisions.slice(0, 5).map((d, i) => `${i + 1}. ${d}`).join("\n") || "None"}

## Follow-ups
${m.actionItems.slice(0, 6).map((a) => `- ${a.owner}: ${a.task}`).join("\n") || "None"}
`;
}

function formatParliamentary(m: Meeting): string {
  return `${header(m, STYLE_LABELS.parliamentary)}

## Minutes of Proceedings

### Resolutions
${m.decisions.map((d) => `**RESOLVED,** that ${d}`).join("\n\n") || "_No motions recorded._"}

### Matters Discussed
${m.transcript.map((s) => `${s.speaker ?? "Member"}: ${s.text}`).join("\n\n")}

### Action Directives
${actionsBlock(m)}
`;
}

function formatAction(m: Meeting): string {
  return `${header(m, STYLE_LABELS.action)}

${actionsBlock(m) || "## Action Items\n\n- None identified\n"}

## Supporting Context
${m.summary ?? ""}

## Source Excerpts
${m.transcript.filter((s) => /action|todo|follow|assign|deadline/i.test(s.text)).map((s) => `- ${s.text}`).join("\n") || "- See full transcript"}
`;
}

const FORMATTERS: Record<MinutesStyle, (m: Meeting) => string> = {
  formal: formatFormal,
  agile: formatAgile,
  executive: formatExecutive,
  parliamentary: formatParliamentary,
  action: formatAction,
};

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export const MINUTES_STYLES: MinutesStyle[] = ["formal", "agile", "executive", "parliamentary", "action"];
