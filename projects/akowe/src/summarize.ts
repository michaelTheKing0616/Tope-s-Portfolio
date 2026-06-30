import { randomUUID } from "node:crypto";
import type { ActionItem, Meeting, SummarizeResult, TranscriptSegment } from "./types.js";

export interface SummarizationProvider {
  readonly name: string;
  summarize(meeting: Pick<Meeting, "title" | "attendees" | "transcript">): Promise<SummarizeResult>;
}

const ACTION_PATTERNS = [
  /\b(will|shall|need to|must|should|action:|todo:|follow up|follow-up)\b[^.!?]*[.!?]/gi,
  /\b(assign(?:ed)? to|owner:)\s+([A-Za-z][\w\s.-]+)/gi,
];

const DECISION_PATTERNS = [
  /\b(agreed|decided|approved|resolved|concluded)\b[^.!?]*[.!?]/gi,
  /\bmotion (?:carried|passed)\b[^.!?]*[.!?]/gi,
];

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);
}

function scoreSentence(s: string, keywords: string[]): number {
  const lower = s.toLowerCase();
  let score = 0;
  for (const k of keywords) if (lower.includes(k)) score += 2;
  if (/\b(decided|action|deadline|owner|risk|blocker)\b/i.test(s)) score += 3;
  return score;
}

function extractActions(fullText: string): ActionItem[] {
  const items: ActionItem[] = [];
  for (const m of fullText.matchAll(ACTION_PATTERNS)) {
    const task = (m[0] ?? "").trim().slice(0, 200);
    if (task.length < 15) continue;
    const ownerMatch = /(?:assign(?:ed)? to|owner:)\s+([A-Za-z][\w.-]+)/i.exec(task);
    items.push({
      id: randomUUID(),
      owner: ownerMatch?.[1] ?? "TBD",
      task: task.replace(/^(action:|todo:)\s*/i, ""),
      status: "open",
    });
  }
  return items.slice(0, 12);
}

function extractDecisions(fullText: string): string[] {
  const out: string[] = [];
  for (const re of DECISION_PATTERNS) {
    for (const m of fullText.matchAll(re)) {
      const s = (m[0] ?? "").trim();
      if (s.length > 10) out.push(s);
    }
  }
  return [...new Set(out)].slice(0, 10);
}

export class OfflineSummarizationProvider implements SummarizationProvider {
  readonly name = "offline-extractive";

  async summarize(meeting: Pick<Meeting, "title" | "attendees" | "transcript">): Promise<SummarizeResult> {
    const fullText = meeting.transcript.map((s) => s.text).join(" ");
    const keywords = [
      ...meeting.title.toLowerCase().split(/\s+/),
      ...meeting.attendees.map((a) => a.toLowerCase()),
      "decision",
      "action",
      "next",
      "deadline",
    ];
    const ranked = sentences(fullText)
      .map((s) => ({ s, score: scoreSentence(s, keywords) }))
      .sort((a, b) => b.score - a.score);
    const top = ranked.slice(0, 5).map((r) => r.s);
    const summary =
      top.length > 0
        ? `**${meeting.title}** — extractive summary:\n\n${top.map((t, i) => `${i + 1}. ${t}`).join("\n")}`
        : "No substantive content to summarize.";
    return {
      summary,
      actionItems: extractActions(fullText),
      decisions: extractDecisions(fullText),
      provider: this.name,
    };
  }
}

export class OpenAISummarizationProvider implements SummarizationProvider {
  readonly name = "openai";

  constructor(
    private readonly apiKey: string,
    private readonly model = "gpt-4o-mini",
  ) {}

  async summarize(meeting: Pick<Meeting, "title" | "attendees" | "transcript">): Promise<SummarizeResult> {
    if (!this.apiKey) throw new Error("OPENAI_API_KEY required");
    const transcript = meeting.transcript
      .map((s) => (s.speaker ? `${s.speaker}: ${s.text}` : s.text))
      .join("\n");
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You produce professional meeting minutes. Return JSON: { summary: string, decisions: string[], actionItems: [{ owner, task, due? }] }",
          },
          {
            role: "user",
            content: `Title: ${meeting.title}\nAttendees: ${meeting.attendees.join(", ")}\n\nTranscript:\n${transcript.slice(0, 12000)}`,
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI summarize failed: ${res.status}`);
    const data = (await res.json()) as { choices: { message: { content: string } }[] };
    const parsed = JSON.parse(data.choices[0]!.message.content) as {
      summary: string;
      decisions: string[];
      actionItems: { owner: string; task: string; due?: string }[];
    };
    return {
      summary: parsed.summary,
      decisions: parsed.decisions ?? [],
      actionItems: (parsed.actionItems ?? []).map((a) => ({
        id: randomUUID(),
        owner: a.owner || "TBD",
        task: a.task,
        due: a.due,
        status: "open" as const,
      })),
      provider: this.name,
    };
  }
}

export function createSummarizationProvider(apiKey: string, model?: string): SummarizationProvider {
  if (apiKey) return new OpenAISummarizationProvider(apiKey, model);
  return new OfflineSummarizationProvider();
}

export function mergeTranscript(segments: TranscriptSegment[]): string {
  return segments.map((s) => (s.speaker ? `${s.speaker}: ${s.text}` : s.text)).join("\n");
}
