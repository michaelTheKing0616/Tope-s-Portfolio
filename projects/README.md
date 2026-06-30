# Portfolio projects

Runnable implementations behind the portfolio case studies ([`/work`](/work)).
Each project is self-contained, tested, and documented as a technical spec — not a tutorial clone.


| Project     | Path                           | Stack                      | Tests              | Dev URL |
| ----------- | ------------------------------ | -------------------------- | ------------------ | ------- |
| LingAfriq   | *(private repo — in progress)* | Flutter, AI                | —                  | —       |
| Sabi        | `projects/sabi`                | Python, agentic AI         | `python -m pytest` | CLI     |
| Kobo        | `projects/kobo`                | TypeScript, Hono, payments | `npm test`         | :8787   |
| Ayo Master  | `projects/ayo-master`          | TypeScript, minimax AI     | `npm test`         | CLI     |
| Tatafo      | `projects/tatafo`              | TypeScript, BM25, web UI   | `npm test`         | :8790   |
| Akowe       | `projects/akowe`               | TypeScript, minutes + AI   | `npm test`         | :8791   |
| SPORTVERSE  | `sportverse`                   | TypeScript, PWA platform   | `npm test`         | :5174   |
| Alo         | `projects/alo`                 | Python, media pipeline     | `python -m pytest` | CLI     |
| naija-utils | `projects/naija-utils`         | TypeScript, OSS lib        | `npm test`         | —       |
| Pulse       | `projects/pulse`               | TypeScript, WebGL viz      | `npm test`         | :5173   |


## Quick start

```bash
# Agentic AI (offline, no API key)
cd projects/sabi && python -m pytest && python -m sabi.cli "check stock for rice"

# Payments / invoicing (production-grade)
cd projects/kobo && npm install && npm test && npm run dev

# Local file search (BM25 + web UI)
cd projects/tatafo && npm install && npm test && npm run web

# Meeting minutes (record, transcribe, summarize)
cd projects/akowe && npm install && npm test && npm run dev

# Sports gaming platform (PWA)
cd sportverse && npm install && npm test && npm run dev:api
# separate terminal: npm run dev  → :5174

# Game AI
cd projects/ayo-master && npm install && npm test && npm run dev

# Creative pipeline
cd projects/alo && python -m pytest

# Nigerian market primitives
cd projects/naija-utils && npm install && npm test

# Real-time viz
cd projects/pulse && npm install && npm test && npm run dev
```

**Full deploy guide:** see [RUN_AND_DEPLOY.md](../RUN_AND_DEPLOY.md) at the portfolio root.

See each project's `README.md` for architecture diagrams and senior-signal notes.