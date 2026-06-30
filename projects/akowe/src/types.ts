export type MinutesStyle = "formal" | "agile" | "executive" | "parliamentary" | "action";

export interface TranscriptSegment {
  speaker?: string;
  startMs?: number;
  endMs?: number;
  text: string;
}

export interface Meeting {
  id: string;
  title: string;
  date: string;
  attendees: string[];
  transcript: TranscriptSegment[];
  rawTranscript?: string;
  summary?: string;
  actionItems: ActionItem[];
  decisions: string[];
  style: MinutesStyle;
  createdAt: string;
  updatedAt: string;
}

export interface ActionItem {
  id: string;
  owner: string;
  task: string;
  due?: string;
  status: "open" | "done";
}

export interface Database {
  meetings: Meeting[];
}

export interface TranscribeInput {
  audioPath?: string;
  text?: string;
  language?: string;
}

export interface TranscribeResult {
  segments: TranscriptSegment[];
  raw: string;
  provider: string;
}

export interface SummarizeResult {
  summary: string;
  actionItems: ActionItem[];
  decisions: string[];
  provider: string;
}
