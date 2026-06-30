---
title: "Akowe"
tagline: "Meeting minutes that write themselves — record, transcribe, summarize, export."
domain: "Full-Stack Web + AI"
domains: ["Web", "AI"]
status: "in-progress"
year: "2026"
stack: ["TypeScript", "Hono", "Whisper", "MediaRecorder", "Minutes templates"]
skill: "Production full-stack with pluggable AI providers and structured document export"
seniorSignal: "Offline-first with optional cloud providers — professional minutes formats, not generic LLM dumps."
summary: "A meeting minutes app: browser recording, Whisper transcription, intelligent summarization, and export in formal, agile, executive, parliamentary, and action-item styles."
order: 9
featured: true
links: []
---

## The problem

Teams spend hours turning raw meeting audio into usable minutes. Generic note apps store blobs of text; they do not produce **board-ready documents**, **action items with owners**, or **audit-friendly records**.

## What I built

`projects/akowe` — TypeScript + Hono with a browser UI:

```text
Browser (record / paste)
        │
        ▼
   Transcription provider
   ├── Offline parser (Speaker: text)
   └── OpenAI Whisper (optional)
        │
        ▼
   Summarization provider
   ├── Extractive offline
   └── GPT structured JSON (optional)
        │
        ▼
   Minutes formatter (5 professional styles)
        │
        ▼
   Export Markdown / HTML
```

## Senior signals

- **Pluggable providers** — works without API keys; cloud is opt-in
- **Structured minutes** — formal, agile, executive, parliamentary, action-focused
- **Atomic JSON persistence** for meetings
- **MediaRecorder** in-browser with server-side Whisper path

## Run

```bash
cd projects/akowe && npm install && npm test && npm run dev
```

Open http://localhost:8791
