import type { APIRoute } from "astro";

export const GET: APIRoute = ({ site }) => {
  const base = (site?.href ?? import.meta.env.SITE ?? "http://localhost:4321").replace(/\/$/, "");
  const body = `User-agent: *
Allow: /

Sitemap: ${base}/sitemap.xml
`;
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
