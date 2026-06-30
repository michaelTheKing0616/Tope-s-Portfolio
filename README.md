# Temitope Olaitan — Portfolio

Award-minded portfolio site for **Temitope Olaitan**, Software Engineer & AI Builder.
Built with [Astro](https://astro.build), Tailwind, and GSAP — static-first, fast, accessible.

Set `PUBLIC_SITE_URL` in your deploy environment (see [`.env.example`](./.env.example)). Local dev uses `http://localhost:4321` by default.

## Quick start

```bash
npm install
npm run dev          # http://localhost:4321
npm run build        # output → dist/
npm run preview      # serve the production build locally
npm run extract:portrait   # one-off: extract images from legacy HTML
```

## What's in this repo

| Path | Purpose |
|------|---------|
| `src/` | Astro pages, components, case-study content |
| `public/` | Static assets (portraits, favicon) |
| `projects/` | Runnable portfolio apps (see `projects/README.md`) |
| `ROADMAP.md` | Deep-research project strategy document |

## Deploy

See **[DEPLOY.md](./DEPLOY.md)** for Netlify, Vercel, and splitting `projects/` into separate GitHub repos.

## Contact form

- **Netlify:** enabled via `data-netlify` on `/contact` + `public/forms.html` for build-time detection.
- **Vercel:** form POST falls back to `mailto:` (no serverless handler included). Add Resend/Formspree if you need server-side delivery on Vercel.

## License

MIT — see [LICENSE](./LICENSE).
