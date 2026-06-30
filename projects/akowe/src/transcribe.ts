import type { TranscribeInput, TranscribeResult } from "./types.js";

export interface TranscriptionProvider {
  readonly name: string;
  transcribe(input: TranscribeInput): Promise<TranscribeResult>;
}

/** Parse pasted transcript into segments (Speaker: text or timestamps). */
export function parseTranscriptText(raw: string): TranscribeResult {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const segments = lines.map((line) => {
    const speakerMatch = /^([A-Za-z][\w\s.-]{0,40}):\s*(.+)$/.exec(line);
    if (speakerMatch) {
      return { speaker: speakerMatch[1]!.trim(), text: speakerMatch[2]!.trim() };
    }
    const tsMatch = /^\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*(.+)$/.exec(line);
    if (tsMatch) {
      return { text: tsMatch[2]!.trim(), startMs: parseTimestamp(tsMatch[1]!) };
    }
    return { text: line };
  });
  return { segments, raw, provider: "offline-parse" };
}

function parseTimestamp(ts: string): number {
  const parts = ts.split(":").map(Number);
  if (parts.length === 2) return (parts[0]! * 60 + parts[1]!) * 1000;
  if (parts.length === 3) return (parts[0]! * 3600 + parts[1]! * 60 + parts[2]!) * 1000;
  return 0;
}

export class OfflineTranscriptionProvider implements TranscriptionProvider {
  readonly name = "offline";

  async transcribe(input: TranscribeInput): Promise<TranscribeResult> {
    if (input.text?.trim()) return parseTranscriptText(input.text);
    if (input.audioPath) {
      return {
        segments: [
          {
            text: `[Audio recorded at ${input.audioPath}] Connect OPENAI_API_KEY for Whisper transcription, or paste transcript text.`,
          },
        ],
        raw: "",
        provider: "offline-audio-placeholder",
      };
    }
    throw new Error("Provide transcript text or audio path");
  }
}

export class WhisperTranscriptionProvider implements TranscriptionProvider {
  readonly name = "whisper";

  constructor(
    private readonly apiKey: string,
    private readonly model = "whisper-1",
  ) {}

  async transcribe(input: TranscribeInput): Promise<TranscribeResult> {
    if (!this.apiKey) throw new Error("OPENAI_API_KEY required for Whisper");
    if (!input.audioPath) throw new Error("audioPath required for Whisper");
    const { readFileSync } = await import("node:fs");
    const { basename } = await import("node:path");
    const buf = readFileSync(input.audioPath);
    const form = new FormData();
    form.append("file", new Blob([buf]), basename(input.audioPath));
    form.append("model", this.model);
    form.append("response_format", "verbose_json");
    if (input.language) form.append("language", input.language);

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: form,
    });
    if (!res.ok) throw new Error(`Whisper failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as {
      text: string;
      segments?: { start: number; end: number; text: string }[];
    };
    const segments =
      data.segments?.map((s) => ({
        startMs: Math.round(s.start * 1000),
        endMs: Math.round(s.end * 1000),
        text: s.text.trim(),
      })) ?? [{ text: data.text }];
    return { segments, raw: data.text, provider: this.name };
  }
}

export function createTranscriptionProvider(apiKey: string): TranscriptionProvider {
  if (apiKey) return new WhisperTranscriptionProvider(apiKey);
  return new OfflineTranscriptionProvider();
}
