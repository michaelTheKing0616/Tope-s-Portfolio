import { defineCollection, z } from "astro:content";

const projects = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    tagline: z.string(),
    /** Primary domain line, e.g. "Agentic AI / Backend". */
    domain: z.string(),
    /** Range tags used for filtering: Web, Mobile, Desktop, AI, Games, Systems. */
    domains: z.array(z.string()),
    status: z.enum(["live", "in-progress", "concept"]),
    year: z.string(),
    stack: z.array(z.string()),
    /** The high-demand 2026 capability this project proves. */
    skill: z.string(),
    /** Why this reads as senior-level. */
    seniorSignal: z.string(),
    summary: z.string(),
    /** Lower numbers sort first. */
    order: z.number().default(50),
    featured: z.boolean().default(false),
    /** Optional slug of an embedded live demo on /demos. */
    demo: z.string().optional(),
    /** Optional source / live links. */
    links: z
      .array(z.object({ label: z.string(), href: z.string() }))
      .default([]),
  }),
});

export const collections = { projects };
