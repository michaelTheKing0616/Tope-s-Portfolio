import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";

// Canonical URL for OG tags, sitemap, and robots.txt.
// Set PUBLIC_SITE_URL in Netlify/Vercel env (e.g. https://your-site.netlify.app).
// Falls back to localhost for local dev.
const site = process.env.PUBLIC_SITE_URL ?? "http://localhost:4321";

export default defineConfig({
  site,
  integrations: [tailwind({ applyBaseStyles: false })],
  build: {
    inlineStylesheets: "auto",
  },
});
