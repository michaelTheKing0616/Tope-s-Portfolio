# Akowe

Meeting minutes app — record, transcribe, summarize, and export in professional formats.

## Features

- **Browser recording** via MediaRecorder (WebM audio)
- **Transcription** — offline paste parser, or **OpenAI Whisper** when `OPENAI_API_KEY` is set
- **Summarization** — extractive offline, or **GPT** for intelligent summaries
- **Export styles**: formal board, agile standup, executive brief, parliamentary, action-items
- **Formats**: Markdown download, print-ready HTML
- **Persistent JSON store** with atomic writes

## Quick start

```bash
cp .env.example .env
npm install
npm test
npm run dev
# → http://localhost:8791
```

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Service status |
| GET/POST | `/api/meetings` | List / create |
| POST | `/api/meetings/:id/transcribe` | `{ text }` or `{ audioBase64 }` |
| POST | `/api/meetings/:id/summarize` | Generate summary + actions |
| GET | `/api/meetings/:id/export?format=md\|html&style=formal` | Download minutes |

## Senior signals

- Pluggable providers (offline default, cloud optional)
- Structured minutes templates (not generic LLM dumps)
- Integer-safe metadata, atomic persistence
- Works without API keys for portfolio demos
