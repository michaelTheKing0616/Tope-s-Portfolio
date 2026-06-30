# Tatafo

Private, local-first file search — **BM25 ranking**, **filesystem watcher**, **web UI**, zero API keys.

## Run

```bash
npm install
npm test
npm run dev index ./notes          # CLI: build index
npm run dev search "payment webhook"
npm run dev watch ./notes          # auto re-index on file change
npm run web                        # http://localhost:8790
```

## Commands

| Command | Description |
|---------|-------------|
| `tatafo index <dir>` | Build BM25 index → `.tatafo/index.json` |
| `tatafo search <query>` | Ranked chunk search |
| `tatafo ask <query>` | Grounded answer with citations |
| `tatafo watch <dir>` | Debounced incremental re-index |
| `tatafo web` | Local search UI + REST API |

## API (web mode)

- `GET /api/search?q=...`
- `GET /api/ask?q=...`
- `POST /api/index` — re-index watch root
- `POST /api/watch/start` — start file watcher

## Senior signals

- **BM25** (Okapi) instead of naive keyword match
- **Incremental upsert** on file change
- **v1 → v2 index migration** on load
- Fully **offline** — nothing leaves your machine
