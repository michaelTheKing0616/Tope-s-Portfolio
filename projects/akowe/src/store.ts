import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Database, Meeting } from "./types.js";

export function loadConfig() {
  return {
    port: Number(process.env.PORT ?? 8791),
    databasePath: resolve(process.env.AKOWE_DATABASE_PATH ?? "./data/akowe.json"),
    openaiKey: process.env.OPENAI_API_KEY ?? "",
    whisperModel: process.env.WHISPER_MODEL ?? "whisper-1",
    chatModel: process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini",
  };
}

export type AkoweConfig = ReturnType<typeof loadConfig>;

function emptyDb(): Database {
  return { meetings: [] };
}

export class MeetingStore {
  private data: Database;
  private readonly path: string;

  constructor(path: string) {
    this.path = path;
    mkdirSync(dirname(path), { recursive: true });
    if (existsSync(path)) {
      this.data = JSON.parse(readFileSync(path, "utf8")) as Database;
    } else {
      this.data = emptyDb();
      this.flush();
    }
  }

  private flush(): void {
    const tmp = `${this.path}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.data, null, 2), "utf8");
    renameSync(tmp, this.path);
  }

  list(): Meeting[] {
    return [...this.data.meetings].sort((a, b) => b.date.localeCompare(a.date));
  }

  get(id: string): Meeting | undefined {
    return this.data.meetings.find((m) => m.id === id);
  }

  save(meeting: Meeting): Meeting {
    const i = this.data.meetings.findIndex((m) => m.id === meeting.id);
    if (i >= 0) this.data.meetings[i] = meeting;
    else this.data.meetings.push(meeting);
    this.flush();
    return meeting;
  }

  delete(id: string): boolean {
    const before = this.data.meetings.length;
    this.data.meetings = this.data.meetings.filter((m) => m.id !== id);
    if (this.data.meetings.length !== before) {
      this.flush();
      return true;
    }
    return false;
  }
}

export class MemoryMeetingStore {
  private meetings: Meeting[] = [];

  list() {
    return [...this.meetings];
  }

  get(id: string) {
    return this.meetings.find((m) => m.id === id);
  }

  save(meeting: Meeting) {
    const i = this.meetings.findIndex((m) => m.id === meeting.id);
    if (i >= 0) this.meetings[i] = meeting;
    else this.meetings.push(meeting);
    return meeting;
  }

  delete(id: string) {
    const before = this.meetings.length;
    this.meetings = this.meetings.filter((m) => m.id !== id);
    return this.meetings.length !== before;
  }
}

export type IMeetingStore = MeetingStore | MemoryMeetingStore;
