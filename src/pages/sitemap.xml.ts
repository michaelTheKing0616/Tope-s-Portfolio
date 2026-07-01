import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

const staticRoutes = ["/", "/work", "/demos", "/play", "/showcase", "/about", "/resume", "/contact"];

export const GET: APIRoute = async ({ site }) => {
  const base = (site?.href ?? import.meta.env.SITE ?? "http://localhost:4321").replace(/\/$/, "");
  const projects = await getCollection("projects");
  const projectRoutes = projects.map((p) => `/work/${p.slug}`);
  const all = [...staticRoutes, ...projectRoutes];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${all
  .map((path) => `  <url><loc>${base}${path}</loc></url>`)
  .join("\n")}
</urlset>
`;

  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
