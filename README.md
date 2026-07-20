# Temitope Olaitan — Portfolio

Award-minded portfolio site for **Temitope Olaitan**, Software Engineer & AI Builder.
Built with [Astro](https://astro.build), Tailwind, and GSAP — static-first, fast, accessible.

Set `PUBLIC_SITE_URL` in your deploy environment (see [`.env.example`](./.env.example)). Local dev uses `http://localhost:4321` by default.

## Quick start

```bash
npm install
npm run dev          # http://localhost:4321
npm run build        # full production build (downloads sports-db, embeds SPORTVERSE, builds site)
npm run build:skip-data   # faster local build if sports-db already fetched
npm run preview      # serve the production build locally
npm run test:projects     # portfolio subproject tests (auto-installs deps)
npm run test:sportverse   # SPORTVERSE unit tests
npm run extract:portrait   # one-off: extract images from legacy HTML
```

**Fresh clone:** `npm run build` downloads the sports-db release bundle automatically (~25 MB gzip). For offline dev without the bundle, tests use `season-stats.fixture.json`; run `npm run build:skip-data` after `npm install` in `sportverse/`.

## What's in this repo

| Path | Purpose |
|------|---------|
| `src/` | Astro pages, components, case-study content |
| `public/` | Static assets (portraits, favicon) |
| `projects/` | Runnable portfolio apps (see `projects/README.md`) |
| `sportverse/` | SPORTVERSE gaming platform (embedded at `/play/sportverse/`) |
| `ROADMAP.md` | Deep-research project strategy document |

## Deploy

See **[RUN_AND_DEPLOY.md](./RUN_AND_DEPLOY.md)** and **[UNIFIED_PLAY_DEPLOY.md](./UNIFIED_PLAY_DEPLOY.md)** for Netlify, Vercel, and unified games deploy.

## Contact form

- **Netlify:** enabled via `data-netlify` on `/contact` + `public/forms.html` for build-time detection.
- **Vercel:** form POST falls back to `mailto:` (no serverless handler included). Add Resend/Formspree if you need server-side delivery on Vercel.

## License

MIT — see [LICENSE](./LICENSE).
