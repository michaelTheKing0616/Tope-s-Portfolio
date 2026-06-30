# Deploy & GitHub guide

> **Full guide:** See [RUN_AND_DEPLOY.md](./RUN_AND_DEPLOY.md) for every app (Kobo, Tatafo, Akowe, Sabi, etc.), env vars, and deployment matrix.

## Portfolio site (this repo)

### Netlify (recommended — contact form works out of the box)

1. Push this repo to GitHub (portfolio only — see **Separate repos** below if you want a slim site repo).
2. [Netlify](https://app.netlify.com) → **Add new site** → **Import from Git**.
3. Build settings (auto-detected from `netlify.toml`):
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Node: 20
4. After deploy, enable **Form notifications** under Site → Forms → contact.
5. Set your custom domain and update `site` in `astro.config.mjs` + `public/robots.txt` + `src/pages/sitemap.xml.ts` to match.

### Vercel

1. Import the GitHub repo on [Vercel](https://vercel.com).
2. Framework preset: **Astro** (uses `vercel.json`).
3. Contact form uses `mailto:` fallback unless you add a serverless handler or Formspree.

### Pre-deploy checklist

- [ ] `npm run build` succeeds locally
- [ ] `public/images/portrait.webp` exists (run `npm run extract:portrait` once if missing)
- [ ] `astro.config.mjs` `site` URL matches your real domain
- [ ] `files (1)/` is **not** committed (legacy 6MB HTML — in `.gitignore`)

---

## Separate GitHub repos

Each app in `projects/` is designed to stand alone. Recommended repo names:

| Folder | Suggested repo | Stack |
|--------|----------------|-------|
| `projects/sabi` | `sabi` | Python |
| `projects/kobo` | `kobo` | TypeScript / Hono |
| `projects/ayo-master` | `ayo-master` | TypeScript / Vite |
| `projects/tatafo` | `tatafo` | TypeScript / CLI |
| `projects/alo` | `alo` | Python |
| `projects/naija-utils` | `naija-utils` | TypeScript npm package |
| `projects/pulse` | `pulse` | TypeScript / WebGL |

### Option A — copy each folder to its own repo

```powershell
# Example: push sabi as its own repo
cd "C:\Users\HP\Desktop\Web portfolio\projects\sabi"
git init
git add .
git commit -m "Initial commit: Sabi agentic AI reference implementation"
git branch -M main
git remote add origin https://github.com/YOUR_USER/sabi.git
git push -u origin main
```

Repeat for each project. Add a root `LICENSE` (MIT) and ensure `.gitignore` includes `node_modules/`, `dist/`, `.pytest_cache/`.

### Option B — slim portfolio repo (site only)

If you do **not** want `projects/` in the portfolio GitHub repo:

1. Create `.gitignore` entry: `projects/` (or push site files from repo root without the folder).
2. Link case studies to external GitHub URLs via `links` in each `src/content/projects/*.md` frontmatter:

```yaml
links:
  - { label: "Source", href: "https://github.com/YOUR_USER/sabi" }
```

### CI when split

`projects/naija-utils/.github/workflows/ci.yml` assumes a monorepo path. When split, move it to the repo root and remove `working-directory: projects/naija-utils` (use `.` instead).

---

## Post-deploy: update case study links

After each project is on GitHub, edit the matching file in `src/content/projects/`:

```yaml
links:
  - { label: "Source", href: "https://github.com/YOUR_USER/REPO" }
```

Rebuild and redeploy the portfolio so `/work/[slug]` shows live links.
