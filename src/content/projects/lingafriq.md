---
title: "LingAfriq"
tagline: "A mobile platform that teaches African languages, built for African learners."
domain: "Mobile + AI"
domains: ["Mobile", "AI"]
status: "in-progress"
year: "2024 — Present"
stack: ["Flutter", "Dart", "REST APIs", "LLM Integration", "ElevenLabs TTS"]
skill: "Cross-platform mobile + adaptive AI personalization"
seniorSignal: "Owns the full product stack end-to-end — UX, learning-science curriculum, Flutter client, and backend — for a real market."
summary: "A cross-platform mobile app for learning Yoruba, Igbo, Hausa and more, with an AI tutor, pronunciation feedback and a culturally-grounded, adaptive curriculum."
order: 1
featured: true
demo: "lingafriq"
links: []
---

## The problem

Global language platforms have historically ignored African languages. Hundreds of millions of speakers and heritage learners have no serious, mobile-first way to study Yoruba, Igbo or Hausa with the polish of a Duolingo. The gap is not just linguistic — it is cultural. Pronunciation, tone and idiom carry meaning that generic templates flatten.

For diaspora learners and continental speakers alike, the product has to feel **built for them**, not adapted from a European language template.

## Target users

- **Heritage learners** reconnecting with a parent tongue outside the classroom.
- **Continental speakers** picking up a second African language for work, travel or family.
- **Educators** who need a credible digital supplement, not a toy flashcard app.

## What I am building

LingAfriq is a Flutter application architected as a complete product, not a demo:

```text
Flutter client (Android / iOS)
        │
        ▼
   REST API + content service
        │
        ├── Curriculum engine (spaced repetition, tone drills)
        ├── AI tutor service (LLM + guardrails)
        └── TTS / pronunciation (ElevenLabs + on-device fallback)
```

- **Learning-science-informed curriculum** — spaced repetition, scaffolded lessons, and tone-aware drills designed around how these languages are actually spoken.
- **AI tutor** — an LLM-backed conversational layer that explains grammar, generates examples, and adapts to the learner's mistakes.
- **Pronunciation + TTS** — text-to-speech for authentic audio and feedback loops on the learner's own speech.
- **Adaptive personalization** — the lesson path responds to performance, surfacing what the learner is weakest at next.

## Engineering decisions

- A single Flutter codebase targets Android and iOS, keeping the client consistent while the backend exposes a clean REST contract.
- AI features are designed as **services with guardrails** — prompts and tool surfaces are versioned, outputs are validated before they reach a learner, and costs are bounded.
- Content is **data-driven** so new languages and lessons ship without client releases.
- Offline-first lesson packs for low-connectivity contexts common across the continent.

## Portfolio demo

The [LingAfriq micro-lesson on `/demos`](/demos#lingafriq) is a browser taste of the product: flip-to-reveal phrases in Yoruba, Igbo and Hausa with best-effort device speech. It is not the app — it shows the interaction model and cultural framing.

## Senior signal

This is product-and-engineering ownership: research, UX, curriculum, a shipping mobile client, and an AI layer that has to be reliable for real people — for an underserved market that matters. The thesis is not "another language app"; it is **African technology built by African hands**.
