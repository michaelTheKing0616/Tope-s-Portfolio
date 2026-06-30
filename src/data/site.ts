export const site = {
  name: "Temitope Olaitan",
  shortName: "T. Olaitan",
  role: "Software Engineer & AI Builder",
  location: "Lagos, Nigeria",
  tagline: "Full-Stack · Mobile · AI Systems",
  thesis:
    "African technology must be built by African hands - software that works for the continent and speaks its languages.",
  intro:
    "A full-stack software engineer and AI systems builder with a rare combination of deep technical craft and product vision. I design and ship across web, mobile, desktop, AI and interactive systems.",
  email: "temitopeolaitanmichael@gmail.com",
  phone: "+234 906 584 3184",
  phoneRaw: "+2349065843184",
  socials: [
    { label: "Email", href: "mailto:temitopeolaitanmichael@gmail.com", handle: "temitopeolaitanmichael@gmail.com" },
    { label: "WhatsApp", href: "https://wa.me/2349065843184", handle: "+234 906 584 3184" },
    { label: "X / Twitter", href: "https://x.com/TemitopeOlait10", handle: "@TemitopeOlait10" },
    { label: "Instagram", href: "https://www.instagram.com/topemichaelolaitan", handle: "@topemichaelolaitan" },
    { label: "Phone", href: "tel:+2349065843184", handle: "+234 906 584 3184" },
  ],
} as const;

export const nav = [
  { label: "Home", href: "/" },
  { label: "Work", href: "/work" },
  { label: "Demos", href: "/demos" },
  { label: "Play", href: "/play" },
  { label: "About", href: "/about" },
  { label: "Resume", href: "/resume" },
  { label: "Contact", href: "/contact" },
] as const;

export const highlights = [
  { stat: "First Class", label: "B.Tech Honours", desc: "Computer Science - Federal University of Technology, Minna" },
  { stat: "Agentic AI", label: "Production Workflows", desc: "LLM orchestration, tool-calling, evals and AI-augmented delivery" },
  { stat: "6 Domains", label: "Genuine Range", desc: "Web, Mobile, Desktop, AI, Games and Systems - shipped, not claimed" },
] as const;
