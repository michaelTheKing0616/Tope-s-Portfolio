# Run & Deploy — Complete Guide

This guide covers **every app** in the portfolio monorepo: how to run locally, test, push to GitHub as separate repos, and deploy to **Netlify** or **Vercel** (where applicable).

**Workspace root:** `C:\Users\HP\Desktop\Web portfolio`

**Prerequisites (all projects):**

- [Node.js 20 LTS](https://nodejs.org/) — for TypeScript apps and the Astro site
- [Python 3.11+](https://www.python.org/) — for Sabi and Alo
- [Git](https://git-scm.com/)
- GitHub account
- (Optional) Netlify and/or Vercel accounts — free tier is sufficient

---

## Table of contents

1. [Portfolio website (Astro)](#1-portfolio-website-astro)
2. [Kobo — invoicing & payments](#2-kobo--invoicing--payments)
3. [Tatafo — local file search](#3-tatafo--local-file-search)
4. [Akowe — meeting minutes](#4-akowe--meeting-minutes)
5. [SPORTVERSE — sports gaming platform](#5-sportverse--sports-gaming-platform)
   - **Unified deploy (portfolio + all games):** see [`UNIFIED_PLAY_DEPLOY.md`](./UNIFIED_PLAY_DEPLOY.md)
6. [Sabi — agentic AI](#6-sabi--agentic-ai)
7. [Ayo Master — game AI](#7-ayo-master--game-ai)
8. [Alo — media pipeline](#8-alo--media-pipeline)
9. [naija-utils — npm library](#9-naija-utils--npm-library)
10. [Pulse — WebGL visualization](#10-pulse--webgl-visualization)
11. [GitHub — separate repos strategy](#11-github--separate-repos-strategy)
12. [Deployment matrix](#12-deployment-matrix)
13. [Environment variables reference](#13-environment-variables-reference)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Portfolio website (Astro)

**Path:** repo root  
**Stack:** Astro 4, Tailwind, GSAP  
**Output:** Static site in `dist/`

### Run locally

```powershell
cd "C:\Users\HP\Desktop\Web portfolio"
npm install
npm run dev
```

Open [http://localhost:4321](http://localhost:4321)

### Build (required before deploy)

```powershell
npm run build
npm run preview   # optional: verify production build
```

### One-time: portrait assets

If `public/images/portrait.webp` is missing:

```powershell
npm run extract:portrait
```

### Deploy to Netlify (recommended)

Netlify Forms work out of the box for the contact page.

1. Push the portfolio repo to GitHub (see [§10](#10-github--separate-repos-strategy)).
2. Go to [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import from Git**.
3. Settings (auto-detected from `netlify.toml`):
  - **Build command:** `npm run build`
  - **Publish directory:** `dist`
  - **Node version:** 20
4. Deploy.
5. **Site configuration → Environment variables:** none required for static site.
6. **Domain:** add custom domain; then update:
  - `astro.config.mjs` → `site: 'https://yourdomain.dev'`
  - `public/robots.txt` → sitemap URL
  - `src/pages/sitemap.xml.ts` → base URL
7. **Forms:** Site → Forms → enable email notifications for `contact`.

### Deploy to Vercel

1. Import repo at [vercel.com](https://vercel.com).
2. Framework: **Astro** (`vercel.json` is included).
3. Deploy. Contact form uses `mailto:` fallback unless you add Formspree or a serverless handler.

### Pre-deploy checklist

- `npm run build` succeeds
- Portrait images exist in `public/images/`
- `PUBLIC_SITE_URL` set in deploy environment (or defaults to localhost)
- `files (1)/` is **not** committed (legacy HTML — in `.gitignore`)

---

## 2. Kobo — invoicing & payments

**Path:** `projects/kobo`  
**Stack:** TypeScript, Hono, atomic JSON store  
**Port:** 8787  
**Tests:** 10 vitest tests

### Run locally

```powershell
cd "C:\Users\HP\Desktop\Web portfolio\projects\kobo"
copy .env.example .env
npm install
npm test
npm run dev
```

- Dashboard: [http://localhost:8787](http://localhost:8787)  
- Health: [http://localhost:8787/health](http://localhost:8787/health)

### Environment variables


| Variable              | Required            | Description                         |
| --------------------- | ------------------- | ----------------------------------- |
| `KOBO_API_KEY`        | Production          | Bearer token for API                |
| `KOBO_DATABASE_PATH`  | No                  | Default `./data/kobo.json`          |
| `KOBO_APP_URL`        | No                  | Base URL for invoice links          |
| `KOBO_BUSINESS_NAME`  | No                  | On PDF/HTML invoices                |
| `KOBO_BUSINESS_EMAIL` | No                  | Reply-to for emails                 |
| `PAYSTACK_SECRET`     | Production webhooks | HMAC verification; empty = dev skip |
| `PORT`                | No                  | Default 8787                        |


### API quick test

```powershell
$KEY = "kobo_dev_key_change_me"
curl -H "Authorization: Bearer $KEY" http://localhost:8787/api/invoices
```

### Deploy (Node server)

Kobo is a **long-running Node server**, not a static site. Recommended hosts:


| Platform                       | Notes                                          |
| ------------------------------ | ---------------------------------------------- |
| [Railway](https://railway.app) | Connect GitHub repo, set env vars, expose port |
| [Render](https://render.com)   | Web Service, `npm run build && npm start`      |
| [Fly.io](https://fly.io)       | `fly launch` + Dockerfile                      |
| VPS (DigitalOcean, etc.)       | `pm2 start dist/bin.js` behind nginx           |


**Build & start commands:**

```bash
npm install
npm run build
node dist/bin.js
```

**Paystack webhook URL:** `https://your-kobo-host/webhooks/paystack`  
Configure in Paystack dashboard; use `x-idempotency-key` header on retries.

### GitHub repo

```powershell
cd "C:\Users\HP\Desktop\Web portfolio\projects\kobo"
git init
git add .
git commit -m "Initial commit: Kobo invoicing with Paystack webhooks"
git branch -M main
git remote add origin https://github.com/YOUR_USER/kobo.git
git push -u origin main
```

Then add to case study `src/content/projects/kobo.md`:

```yaml
links:
  - { label: "Source", href: "https://github.com/YOUR_USER/kobo" }
```

---

## 3. Tatafo — local file search

**Path:** `projects/tatafo`  
**Stack:** TypeScript, BM25, Hono web UI  
**Port:** 8790 (web mode)  
**Tests:** vitest (search, BM25, chunker)

### Run locally — CLI

```powershell
cd "C:\Users\HP\Desktop\Web portfolio\projects\tatafo"
npm install
npm test

# Index your notes folder
npm run dev index "C:\Users\HP\Documents\notes"

# Search
npm run dev search "payment webhook"

# Grounded answer
npm run dev ask "idempotent webhook"

# Watch for file changes (incremental re-index)
npm run dev watch "C:\Users\HP\Documents\notes"
```

### Run locally — Web UI

```powershell
npm run web
```

Open [http://localhost:8790](http://localhost:8790) — search, re-index, start file watcher from the UI.

### Deploy

Tatafo is **local-first**. The web UI is for personal use on localhost or a private VPS.

For a **team internal search** on a VPS:

1. Index documents on the server: `tatafo index /data/docs`
2. Run web: `PORT=8790 npm run web`
3. Put nginx in front with basic auth.

**Not suitable for Netlify/Vercel** (needs filesystem + persistent index).

### GitHub repo

```powershell
cd "C:\Users\HP\Desktop\Web portfolio\projects\tatafo"
git init
git add .
git commit -m "Initial commit: Tatafo BM25 local search"
git branch -M main
git remote add origin https://github.com/YOUR_USER/tatafo.git
git push -u origin main
```

---

## 4. Akowe — meeting minutes

**Path:** `projects/akowe`  
**Stack:** TypeScript, Hono, MediaRecorder, optional Whisper/GPT  
**Port:** 8791  
**Tests:** vitest (transcribe, summarize, minutes formats)

### Run locally

```powershell
cd "C:\Users\HP\Desktop\Web portfolio\projects\akowe"
copy .env.example .env
npm install
npm test
npm run dev
```

Open [http://localhost:8791](http://localhost:8791)

### Workflow

1. **Create meeting** — title, date, attendees, style (formal / agile / executive / parliamentary / action)
2. **Record** audio in browser OR **paste transcript** (`Speaker: text` format)
3. **Process transcript** — offline parser, or Whisper if `OPENAI_API_KEY` is set
4. **Summarize** — extractive offline, or GPT structured JSON
5. **Export** Markdown or HTML in chosen style

### Environment variables


| Variable              | Required | Description                         |
| --------------------- | -------- | ----------------------------------- |
| `PORT`                | No       | Default 8791                        |
| `AKOWE_DATABASE_PATH` | No       | `./data/akowe.json`                 |
| `OPENAI_API_KEY`      | Optional | Enables Whisper + GPT summarization |
| `WHISPER_MODEL`       | No       | Default `whisper-1`                 |
| `OPENAI_CHAT_MODEL`   | No       | Default `gpt-4o-mini`               |


**Offline mode works fully** without any API keys — paste transcripts and use extractive summarization.

### Deploy

Same as Kobo — Node server on Railway/Render/Fly/VPS:

```bash
npm install && npm run build && node dist/bin.js
```

Use HTTPS in production (required for `getUserMedia` recording in most browsers).

### GitHub repo

```powershell
cd "C:\Users\HP\Desktop\Web portfolio\projects\akowe"
git init
git add .
git commit -m "Initial commit: Akowe meeting minutes"
git branch -M main
git remote add origin https://github.com/YOUR_USER/akowe.git
git push -u origin main
```

---

## 5. SPORTVERSE — sports gaming platform

**Path:** `sportverse`  
**Stack:** TypeScript, Vite PWA, Hono API, quiz + sim engines  
**Ports:** Web `:5174` · API `:8792`

### Run locally

```powershell
cd "C:\Users\HP\Desktop\Web portfolio\sportverse"
npm install
npm test

# Terminal 1 — API
npm run dev:api

# Terminal 2 — PWA
npm run dev
```

Open http://localhost:5174

### What's included (Alpha)

- **Football IQ** — 5 tactical scenarios with coaching explanations
- **Goalkeeper Instinct** — 20 penalty levels
- **Sports IQ** — Who Am I, Speed Round, Guess Club, Career Path, True/False
- **Platform** — XP, coins, streak, achievements, daily challenge, leaderboard

### Deploy

| Part | Host | Notes |
|------|------|-------|
| Web PWA | Netlify / Vercel | `npm run build -w @sportverse/web` → `apps/web/dist` |
| API | Railway / Render | `services/api` — set `PORT`, `SPORTVERSE_DATABASE_PATH` |

Set `VITE_API_URL` in the web build environment to your API URL.

### GitHub repo

```powershell
cd "C:\Users\HP\Desktop\Web portfolio\sportverse"
git init
git add .
git commit -m "Initial commit: SPORTVERSE alpha"
git branch -M main
git remote add origin https://github.com/YOUR_USER/sportverse.git
git push -u origin main
```

---

## 6. Sabi — agentic AI

**Path:** `projects/sabi`  
**Stack:** Python 3.11+, stdlib only (offline)

```powershell
cd "C:\Users\HP\Desktop\Web portfolio\projects\sabi"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
python -m pytest
python -m sabi.cli "check inventory for rice"
```

**Deploy:** CLI/library — publish to PyPI or run as internal tool. Not a web deploy.

**GitHub:**

```powershell
git init
git add .
git commit -m "Initial commit: Sabi agentic AI"
git remote add origin https://github.com/YOUR_USER/sabi.git
git push -u origin main
```

---

## 7. Ayo Master — game AI

**Path:** `projects/ayo-master`

```powershell
cd "C:\Users\HP\Desktop\Web portfolio\projects\ayo-master"
npm install
npm test
npm run dev
```

Pure TypeScript minimax engine — CLI/Vite demo. Static build can go to Netlify/Vercel if you add a `dist` export.

---

## 8. Alo — media pipeline

**Path:** `projects/alo`

```powershell
cd "C:\Users\HP\Desktop\Web portfolio\projects\alo"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
python -m pytest
```

Python CLI pipeline — deploy as worker/cron on any Python host.

---

## 9. naija-utils — npm library

**Path:** `projects/naija-utils`

```powershell
cd "C:\Users\HP\Desktop\Web portfolio\projects\naija-utils"
npm install
npm test
npm run build
```

**Publish to npm** (when ready):

```powershell
npm login
npm publish --access public
```

CI workflow is in `.github/workflows/ci.yml` — move to repo root when split from monorepo.

---

## 10. Pulse — WebGL visualization

**Path:** `projects/pulse`

```powershell
cd "C:\Users\HP\Desktop\Web portfolio\projects\pulse"
npm install
npm test
npm run dev
```

Vite dev server (~5173). **Deploy static `dist/`** to Netlify/Vercel after `npm run build`.

---

## 11. GitHub — separate repos strategy

You have two valid strategies:

### Strategy A — Monorepo (one GitHub repo)

Push the entire `Web portfolio` folder. Simpler, one clone. Case studies link to paths in-repo.

```powershell
cd "C:\Users\HP\Desktop\Web portfolio"
git init
git add .
git commit -m "Portfolio site + project implementations"
git branch -M main
git remote add origin https://github.com/YOUR_USER/portfolio.git
git push -u origin main
```

### Strategy B — Separate repos (recommended for senior signal)


| Folder                 | Suggested repo name                  |
| ---------------------- | ------------------------------------ |
| Root (site only)       | `portfolio` or your name |
| `projects/kobo`        | `kobo`                               |
| `projects/tatafo`      | `tatafo`                             |
| `projects/akowe`       | `akowe`                              |
| `sportverse`           | `sportverse`                         |
| `projects/sabi`        | `sabi`                               |
| `projects/ayo-master`  | `ayo-master`                         |
| `projects/alo`         | `alo`                                |
| `projects/naija-utils` | `naija-utils`                        |
| `projects/pulse`       | `pulse`                              |


**Per-project push (template):**

```powershell
cd "C:\Users\HP\Desktop\Web portfolio\projects\PROJECT_NAME"
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USER/PROJECT_NAME.git
git push -u origin main
```

**Slim portfolio repo (site without `projects/`):**

Add to root `.gitignore`:

```
projects/
files (1)/
```

Link each case study via `links:` in `src/content/projects/*.md`.

---

## 12. Deployment matrix


| Project           | Netlify | Vercel        | Railway/Render | Notes                  |
| ----------------- | ------- | ------------- | -------------- | ---------------------- |
| Portfolio (Astro) | ✅ Best  | ✅             | —              | Static `dist/`         |
| Kobo              | ❌       | ❌ Serverless* | ✅              | Node API + webhooks    |
| Tatafo            | ❌       | ❌             | ✅ VPS          | Needs local filesystem |
| Akowe             | ❌       | ❌ Serverless* | ✅              | Node API + mic (HTTPS) |
| SPORTVERSE        | ✅ PWA   | ✅ PWA         | ✅ API          | Web static + Node API  |
| Sabi              | ❌       | ❌             | ✅ Worker       | Python CLI             |
| Ayo Master        | ✅       | ✅             | —              | If built to static     |
| Alo               | ❌       | ❌             | ✅ Worker       | Python                 |
| naija-utils       | —       | —             | —              | npm package            |
| Pulse             | ✅       | ✅             | —              | Static Vite build      |


Vercel serverless is possible with adapters but webhook raw-body + persistence need extra setup; Railway/Render is simpler.

---

## 13. Environment variables reference

### Portfolio site

| Variable | Required | Description |
|----------|----------|-------------|
| `PUBLIC_SITE_URL` | Production | Canonical URL for OG tags, sitemap, robots.txt (e.g. `https://your-site.netlify.app`) |

### Kobo (`projects/kobo/.env`)

See [§2](#2-kobo--invoicing--payments).

### Akowe (`projects/akowe/.env`)

See [§4](#4-akowe--meeting-minutes).

### Tatafo

No env required. Optional `PORT=8790`.

### SPORTVERSE

| Variable | Service | Description |
|----------|---------|-------------|
| `VITE_API_URL` | web | API base URL for player sync |
| `PORT` | api | Default 8792 |
| `SPORTVERSE_DATABASE_PATH` | api | Player JSON store |

---

## 14. Troubleshooting

### PowerShell: `&&` not valid

Use semicolons:

```powershell
cd "path" ; npm install ; npm test
```

### `npm run build` slow or hangs

Ensure project is on **Desktop** not Downloads. Close antivirus scan on `node_modules` if needed.

### Kobo webhook 401

Set `PAYSTACK_SECRET` and ensure Paystack sends `x-paystack-signature` on raw body.

### Akowe recording blocked

Browsers require **HTTPS** (or localhost) for microphone access.

### Tatafo "No index yet"

Run `tatafo index <folder>` or click **Re-index** in web UI.

### Vitest `describe is not defined`

Ensure test files import from vitest:

```ts
import { describe, expect, it } from "vitest";
```

### Netlify form not receiving submissions

Deploy once with `public/forms.html` present. Check Netlify → Forms → form name `contact`.

---

## Quick command reference (copy-paste)

```powershell
# Portfolio
cd "C:\Users\HP\Desktop\Web portfolio" ; npm install ; npm run build

# All TypeScript apps — test
cd "C:\Users\HP\Desktop\Web portfolio\projects\kobo" ; npm test
cd "C:\Users\HP\Desktop\Web portfolio\projects\tatafo" ; npm test
cd "C:\Users\HP\Desktop\Web portfolio\projects\akowe" ; npm test
cd "C:\Users\HP\Desktop\Web portfolio\projects\ayo-master" ; npm test
cd "C:\Users\HP\Desktop\Web portfolio\projects\naija-utils" ; npm test
cd "C:\Users\HP\Desktop\Web portfolio\projects\pulse" ; npm test
cd "C:\Users\HP\Desktop\Web portfolio\sportverse" ; npm test

# Python apps
cd "C:\Users\HP\Desktop\Web portfolio\projects\sabi" ; python -m pytest
cd "C:\Users\HP\Desktop\Web portfolio\projects\alo" ; python -m pytest

# Dev servers (run in separate terminals)
cd "C:\Users\HP\Desktop\Web portfolio" ; npm run dev
cd "C:\Users\HP\Desktop\Web portfolio\projects\kobo" ; npm run dev
cd "C:\Users\HP\Desktop\Web portfolio\projects\tatafo" ; npm run web
cd "C:\Users\HP\Desktop\Web portfolio\projects\akowe" ; npm run dev
cd "C:\Users\HP\Desktop\Web portfolio\sportverse" ; npm run dev:api
cd "C:\Users\HP\Desktop\Web portfolio\sportverse" ; npm run dev
```

---

*Last updated: June 2026*