---
title: "Alo"
tagline: "African folktales, retold as narrated video by an AI pipeline."
domain: "Creative AI / Media"
domains: ["AI", "Web"]
status: "in-progress"
year: "2026"
stack: ["Python", "LLM", "ElevenLabs TTS", "AI Video Pipeline", "FFmpeg"]
skill: "End-to-end generative media pipeline"
seniorSignal: "Orchestrates a multi-stage generative pipeline — not a single API call — with quality gates between stages."
summary: "A studio that turns a prompt into a narrated, captioned short film of an African folktale: script generation, voiceover, visuals and assembly stitched into one pipeline."
order: 6
featured: false
links: []
---

## The idea

"Alo o!" — the call that opens a Yoruba folktale. Alo is a pipeline that preserves and reimagines these stories as short narrated videos, blending cultural heritage with a modern generative media stack.

## What I built

A complete, **offline-runnable** orchestrator in `projects/alo`:

```text
prompt
  │
  ▼  script stage   (LLM)        ─ quality gate: >=2 scenes, narration present
  ▼  voice stage    (TTS)        ─ quality gate: track per scene, positive duration
  ▼  visual stage   (image)      ─ quality gate: image per scene
  ▼  assemble stage (FFmpeg)     ─ quality gate: scene count + duration match
  ▼
PipelineResult { artifacts, trace, success }
```

Every external service is behind a `Protocol` with a **deterministic stub**, so the whole pipeline runs and tests without API keys. Swap in real providers by implementing the protocols — the orchestrator does not change.

## Engineering decisions

- **Stages are independent and retriable.** `TransientError`s backoff and retry; after `max_attempts` the failure is traced, not thrown into the caller.
- **Content-addressed cache.** A later-stage retry never recomputes an earlier stage's output.
- **Quality gates between stages.** `quality.py` rejects incoherent output (e.g. audio that does not cover every scene) before the next stage builds on it.
- **Full tracing.** Every span, retry and cache hit is recorded — generative systems are debugged from traces, not printf.

## Results

```bash
cd projects/alo
python -m alo.cli "the tortoise and the birds"
python -m pytest
```

Tests cover end-to-end success, cache reuse, retry-then-succeed, give-up-after-max-attempts, quality-gate rejection and caption timing.

## Senior signal

A real generative *system*: independent retriable stages, explicit quality gates and full tracing. That orchestration discipline — not prompt cleverness — is what makes creative AI dependable.
