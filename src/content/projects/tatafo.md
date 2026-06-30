---
title: "Tatafo"
tagline: "A private, local-first desktop assistant that knows your files."
domain: "Desktop + AI"
domains: ["Desktop", "AI"]
status: "in-progress"
year: "2026"
stack: ["TypeScript", "BM25", "File watcher", "Web UI", "Offline index"]
skill: "Native desktop (Tauri/Rust) + offline retrieval"
seniorSignal: "Privacy-first AI that runs locally — desktop range plus systems-level retrieval without cloud APIs."
summary: "A cross-platform system that indexes your local documents and answers questions from them entirely offline — chunking, TF-IDF retrieval, grounded citations, no data leaves the machine."
order: 5
featured: false
links: []
---

## The problem

Knowledge workers sit on gigabytes of their own notes, PDFs and code — but searching it is keyword-shallow, and cloud AI tools mean handing private data to someone else. Tatafo keeps everything on-device.

## Target users

- **Developers and writers** with large local note corpora.
- **Privacy-conscious professionals** who cannot send client documents to a cloud model.
- **Anyone** who wants "ask my files" without "upload my files."

## What I built

The portable core lives in `projects/tatafo`:

```text
Local .md / .txt folders
        │
        ▼
   Indexer (walk + overlapping chunks)
        │
        ▼
   TF-IDF vectors + IDF table ──persist──▶ .tatafo/index.json
        │
        ▼
   search / ask ──▶ ranked passages + citations
```

CLI commands:

```bash
tatafo index ./docs --out .tatafo/index.json
tatafo ask "how do webhooks stay idempotent?"
```

## Engineering decisions

- **No network in the core path.** Privacy is architectural, not a policy paragraph.
- **TF-IDF first.** Honest scope: keyword-grade recall, fully offline, deterministic tests. On-device embeddings are the documented upgrade path.
- **Grounded answers.** `ask` returns cited passages (`file:line`) so answers are visibly constrained to retrieval — not free-form generation.
- **Tauri as production shell.** This repo ships the engine; a Rust/Tauri wrapper adds native folder pickers, file watching and a small UI without changing retrieval logic.

## Results

```bash
cd projects/tatafo
npm install && npm test
```

Tests cover chunking, index construction, ranking and citation formatting.

## Senior signal

Desktop delivery, a real retrieval pipeline, and a deliberate privacy architecture — plus a credible path to a native shell without rewriting the core.
