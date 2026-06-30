/**
 * Resume content, carried over verbatim from the original resume.html and
 * structured as data so the resume page (and any future PDF/JSON export) stays
 * single-sourced.
 */

export interface ExperienceItem {
  role: string;
  org: string;
  date: string;
  bullets: string[];
}

export interface EducationItem {
  degree: string;
  honour: string;
  school: string;
  year: string;
}

export interface SkillGroup {
  label: string;
  skills: { name: string; emphasis?: boolean }[];
}

export const profile =
  "A full-stack software engineer and AI systems builder who pairs deep technical craft with product vision. I design and ship across web, mobile, desktop, AI and interactive systems — driven by the conviction that African technology must be built by African hands, creating software that works for the continent and speaks its languages.";

export const experience: ExperienceItem[] = [
  {
    role: "Senior Software Developer",
    org: "LingAfriq",
    date: "2024 — Present",
    bullets: [
      "Developing a cross-platform mobile application for African language learning, serving speakers across the continent who have been historically underserved by global language platforms.",
      "Architecting the full product stack — from UX design and learning-science-informed curriculum to the Flutter-based mobile client and backend API infrastructure.",
      "Integrating AI-driven personalisation engines and LLM-powered language tools to deliver adaptive, culturally grounded learning experiences.",
    ],
  },
  {
    role: "Backend Development Intern",
    org: "GxInformatics",
    date: "2024",
    bullets: [
      "Designed and implemented RESTful Web APIs consumed by production web applications.",
      "Operated within a professional SDLC environment, contributing to cross-functional engineering collaboration across active projects.",
      "Conducted rigorous system and integration testing across multiple web application projects, ensuring quality and reliability at scale.",
    ],
  },
  {
    role: "Web Development Student — Top Graduate",
    org: "ACCI BEST 1000 Bootcamp",
    date: "2019",
    bullets: [
      "Mastered core web technologies — HTML, CSS, and JavaScript — through intensive, project-driven instruction.",
      "Delivered a complete website as the programme's capstone project; recognised as Best Student upon graduation.",
    ],
  },
  {
    role: "IT Operations Attendant",
    org: "Estate-Biz Center",
    date: "2019",
    bullets: [
      "Managed digital services including document processing, printing, and direct client support — building early professional discipline and a strong service ethic.",
    ],
  },
];

export const education: EducationItem[] = [
  {
    degree: "Bachelor of Technology — Computer Science",
    honour: "First Class Honours",
    school: "Federal University of Technology, Minna",
    year: "2020 – 2025",
  },
  {
    degree: "National Diploma — Computer Science",
    honour: "Distinction",
    school: "Federal Polytechnic, Bida",
    year: "2016 – 2018",
  },
];

export const skillGroups: SkillGroup[] = [
  {
    label: "Languages",
    skills: [
      { name: "Python", emphasis: true },
      { name: "JavaScript / TS", emphasis: true },
      { name: "Dart / Flutter", emphasis: true },
      { name: "HTML & CSS" },
      { name: "SQL" },
    ],
  },
  {
    label: "Frameworks & Backend",
    skills: [
      { name: "Node.js" },
      { name: "REST APIs" },
      { name: "React" },
      { name: "Astro" },
      { name: "Bootstrap" },
    ],
  },
  {
    label: "AI Engineering",
    skills: [
      { name: "LLM Integration", emphasis: true },
      { name: "Claude / GPT APIs", emphasis: true },
      { name: "Prompt Engineering", emphasis: true },
      { name: "AI-Augmented Dev", emphasis: true },
      { name: "Cursor / Copilot" },
      { name: "ElevenLabs TTS" },
      { name: "AI Video Pipelines" },
    ],
  },
  {
    label: "Tools & Practice",
    skills: [
      { name: "Git / GitHub" },
      { name: "SDLC" },
      { name: "Agile" },
      { name: "System Testing" },
      { name: "Netlify" },
    ],
  },
];

export const interests = [
  {
    icon: "\u{1F4DA}",
    name: "Reading",
    desc: "From speculative history and African mythology to computer science papers — books are where worldviews get rebuilt from the ground up.",
  },
  {
    icon: "\u{1F4BB}",
    name: "Coding",
    desc: "Building things for the joy of it — side projects, experiments, and tools that scratch an itch. The best work starts as a hobby.",
  },
  {
    icon: "\u{1F3B5}",
    name: "Music",
    desc: "A constant companion through long build sessions — from afrobeats to ambient, music shapes the energy of the work.",
  },
  {
    icon: "\u{1F3AE}",
    name: "Gaming",
    desc: "Strategy, narrative, and world-building in interactive form. Gaming taught systems thinking before software did.",
  },
] as const;
